import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat8 "mo:base/Nat8";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import TrieMap "mo:base/TrieMap";

// PR11.1: actor class so we can pass the ICP ledger canister id at deploy
// time. Omit the arg (or pass `(null)`) to use mainnet's ledger;
// pass `(opt record { ledger = principal "<id>" })` for local dev.
actor class DBank(initArgs : ?{ ledger : Principal }) = self {

  // ─── Constants ───────────────────────────────────────────────────────────
  let E8S_PER_ICP : Nat = 100_000_000;
  let networkFee : Nat = 50_000;       // 0.0005 ICP
  let withdrawalFee : Nat = 100_000;   // 0.001  ICP

  let perSecondRate : Float = 1.01 ** (1.0 / 86400.0);
  let MAX_COMPOUND_ELAPSED_S : Int = 31_536_000;
  let MAX_TX_LOG : Nat = 100;
  let MIN_OP_INTERVAL_NS : Int = 100_000_000;
  let MAX_TX_AMOUNT : Nat = 1_000_000_000 * E8S_PER_ICP;

  // PR11.4: with real ledger custody, the simulated 1%-daily interest
  // assumed every internal e8s was an unbacked claim that grew "for free".
  // That breaks once balances are 1:1 claims on real ICP held in the
  // ledger — without a funded reserve, paying interest would mean
  // honouring claims you can't redeem. Default to disabled. A canister
  // operator can enable it later (after pre-funding a reserve canister
  // subaccount) via setAccrueInterest().
  stable var accrueInterest : Bool = false;

  // Mainnet ICP ledger when no init arg is supplied.
  let mainnetLedgerPrincipal : Principal = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai");

  let ledgerPrincipal : Principal = switch (initArgs) {
    case (?args) args.ledger;
    case null mainnetLedgerPrincipal;
  };

  // ─── ICRC-1 types ────────────────────────────────────────────────────────
  public type Subaccount = [Nat8];

  public type LedgerAccount = {
    owner : Principal;
    subaccount : ?Subaccount;
  };

  // ICRC-1 transfer types.
  public type TransferLedgerError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type TransferArgs = {
    from_subaccount : ?Subaccount;
    to : LedgerAccount;
    amount : Nat;
    fee : ?Nat;
    memo : ?[Nat8];
    created_at_time : ?Nat64;
  };

  public type LedgerTransferResult = {
    #Ok : Nat;
    #Err : TransferLedgerError;
  };

  // Minimal ICRC-1 ledger interface — just the calls dbank needs.
  type Ledger = actor {
    icrc1_balance_of : (LedgerAccount) -> async Nat;
    icrc1_fee : () -> async Nat;
    icrc1_transfer : (TransferArgs) -> async LedgerTransferResult;
  };

  let ledger : Ledger = actor (Principal.toText(ledgerPrincipal));

  // ─── App types (unchanged from PR9) ─────────────────────────────────────
  public type TransactionKind = { #topUp; #withdraw; #deposit };

  public type Transaction = {
    kind : TransactionKind;
    amount : Nat;
    fee : Nat;
    balanceAfter : Nat;
    timestamp : Int;
  };

  public type TransferError = {
    #invalidAmount;
    #amountTooLarge : { max : Nat };
    #belowFee : { fee : Nat };
    #insufficientFunds : { balance : Nat; required : Nat };
    #rateLimited : { retryAfterNs : Int };
    #ledgerError : TransferLedgerError;
    #ledgerUnreachable : { message : Text };
  };

  public type Result<T, E> = { #ok : T; #err : E };

  type Account = {
    var balance : Nat;                  // internal balance (e8s)
    var lastSeenLedgerBalance : Nat;    // ledger balance at last reconciliation
    var lastCompoundedAt : Int;
    var lastOpAt : Int;
    transactions : Buffer.Buffer<Transaction>;
  };

  type StableAccount = {
    balance : Nat;
    lastSeenLedgerBalance : Nat;
    lastCompoundedAt : Int;
    lastOpAt : Int;
    transactions : [Transaction];
  };

  stable var accountEntries : [(Principal, StableAccount)] = [];

  let accounts = TrieMap.TrieMap<Principal, Account>(Principal.equal, Principal.hash);

  for ((p, sa) in accountEntries.vals()) {
    let txBuf = Buffer.Buffer<Transaction>(sa.transactions.size());
    for (tx in sa.transactions.vals()) txBuf.add(tx);
    accounts.put(p, {
      var balance = sa.balance;
      var lastSeenLedgerBalance = sa.lastSeenLedgerBalance;
      var lastCompoundedAt = sa.lastCompoundedAt;
      var lastOpAt = sa.lastOpAt;
      transactions = txBuf;
    });
  };

  system func preupgrade() {
    let buf = Buffer.Buffer<(Principal, StableAccount)>(accounts.size());
    for ((p, a) in accounts.entries()) {
      buf.add((p, {
        balance = a.balance;
        lastSeenLedgerBalance = a.lastSeenLedgerBalance;
        lastCompoundedAt = a.lastCompoundedAt;
        lastOpAt = a.lastOpAt;
        transactions = Buffer.toArray(a.transactions);
      }));
    };
    accountEntries := Buffer.toArray(buf);
  };

  system func postupgrade() {
    accountEntries := [];
  };

  func requireAuthed(p : Principal) {
    assert not Principal.isAnonymous(p);
  };

  func getOrCreate(p : Principal) : Account {
    switch (accounts.get(p)) {
      case (?a) a;
      case null {
        let a : Account = {
          var balance = 0;
          var lastSeenLedgerBalance = 0;
          var lastCompoundedAt = Time.now();
          var lastOpAt = 0;
          transactions = Buffer.Buffer<Transaction>(8);
        };
        accounts.put(p, a);
        a;
      };
    };
  };

  func rateLimitWait(a : Account) : Int {
    let now = Time.now();
    let next = a.lastOpAt + MIN_OP_INTERVAL_NS;
    if (now >= next) 0 else (next - now);
  };

  func compoundAccount(a : Account) {
    let now = Time.now();
    let rawElapsed : Int = (now - a.lastCompoundedAt) / 1_000_000_000;
    let elapsedS : Int = if (rawElapsed > MAX_COMPOUND_ELAPSED_S) MAX_COMPOUND_ELAPSED_S else rawElapsed;
    if (not accrueInterest) {
      // Custody mode: just advance the anchor so when interest is later
      // enabled the meter starts from now, not from the deposit time.
      if (rawElapsed > 0) a.lastCompoundedAt := now;
      return;
    };
    if (elapsedS > 0 and a.balance > 0) {
      let asFloat = Float.fromInt(a.balance);
      let multiplied = asFloat * (perSecondRate ** Float.fromInt(elapsedS));
      a.balance := Int.abs(Float.toInt(multiplied));
      a.lastCompoundedAt += elapsedS * 1_000_000_000;
    } else if (rawElapsed > 0) {
      a.lastCompoundedAt := now;
    };
  };

  func recordTx(a : Account, kind : TransactionKind, amount : Nat, fee : Nat) {
    if (a.transactions.size() >= MAX_TX_LOG) {
      ignore a.transactions.remove(0);
    };
    a.transactions.add({
      kind;
      amount;
      fee;
      balanceAfter = a.balance;
      timestamp = Time.now();
    });
    a.lastOpAt := Time.now();
  };

  // ─── Subaccount derivation (PR11.1) ─────────────────────────────────────
  // Zero-pad the caller's principal blob to 32 bytes. Deterministic and
  // reversible; matches the convention used by NNS-Dapp and OISY for
  // subaccount-per-user designs.
  func subaccountFor(user : Principal) : Subaccount {
    let bytes = Blob.toArray(Principal.toBlob(user));
    Array.tabulate<Nat8>(32, func(i) {
      if (i < bytes.size()) bytes[i] else (0 : Nat8);
    });
  };

  // ─── App methods (PR9 set, unchanged) ───────────────────────────────────
  public shared (msg) func topUp(amount : Nat) : async Result<(), TransferError> {
    requireAuthed(msg.caller);
    if (amount == 0) return #err(#invalidAmount);
    if (amount > MAX_TX_AMOUNT) return #err(#amountTooLarge({ max = MAX_TX_AMOUNT }));
    if (amount <= networkFee) return #err(#belowFee({ fee = networkFee }));
    let a = getOrCreate(msg.caller);
    let wait = rateLimitWait(a);
    if (wait > 0) return #err(#rateLimited({ retryAfterNs = wait }));
    compoundAccount(a);
    a.balance += amount - networkFee;
    recordTx(a, #topUp, amount, networkFee);
    #ok(());
  };

  // PR11.3: real withdraw via icrc1_transfer.
  //
  // Race-condition note: a concurrent notifyDeposit could otherwise see
  // (onLedger - lastSeen) and credit the user with the in-flight outgoing
  // transfer. We pre-decrement `lastSeenLedgerBalance` *before* the await
  // so the in-flight transfer never looks like a deposit. If the transfer
  // fails, we restore lastSeen and refund internal balance.
  public shared (msg) func withdraw(amount : Nat, dest : LedgerAccount) : async Result<Nat, TransferError> {
    requireAuthed(msg.caller);
    if (amount == 0) return #err(#invalidAmount);
    if (amount > MAX_TX_AMOUNT) return #err(#amountTooLarge({ max = MAX_TX_AMOUNT }));

    let a = getOrCreate(msg.caller);
    let wait = rateLimitWait(a);
    if (wait > 0) return #err(#rateLimited({ retryAfterNs = wait }));

    compoundAccount(a);

    let ledgerFee : Nat = try {
      await ledger.icrc1_fee();
    } catch (err) {
      return #err(#ledgerUnreachable({ message = debug_show err }));
    };

    let totalNeeded = amount + ledgerFee;
    if (a.balance < totalNeeded) {
      return #err(#insufficientFunds({ balance = a.balance; required = totalNeeded }));
    };

    // Reserve before the transfer call.
    a.balance -= totalNeeded;
    let prevLastSeen = a.lastSeenLedgerBalance;
    a.lastSeenLedgerBalance := if (a.lastSeenLedgerBalance >= totalNeeded) {
      a.lastSeenLedgerBalance - totalNeeded;
    } else { 0 };
    a.lastOpAt := Time.now();

    let result : LedgerTransferResult = try {
      await ledger.icrc1_transfer({
        from_subaccount = ?subaccountFor(msg.caller);
        to = dest;
        amount;
        fee = ?ledgerFee;
        memo = null;
        created_at_time = null;
      });
    } catch (err) {
      // Inter-canister call failed at the system level; refund.
      a.balance += totalNeeded;
      a.lastSeenLedgerBalance := prevLastSeen;
      return #err(#ledgerUnreachable({ message = debug_show err }));
    };

    switch (result) {
      case (#Ok blockIndex) {
        recordTx(a, #withdraw, amount, ledgerFee);
        #ok(blockIndex);
      };
      case (#Err err) {
        // Ledger rejected (BadFee, InsufficientFunds, etc). Refund.
        a.balance += totalNeeded;
        a.lastSeenLedgerBalance := prevLastSeen;
        #err(#ledgerError(err));
      };
    };
  };

  public shared query (msg) func checkBalance() : async Nat {
    requireAuthed(msg.caller);
    switch (accounts.get(msg.caller)) {
      case (?a) a.balance;
      case null 0;
    };
  };

  public shared (msg) func compound() : async () {
    requireAuthed(msg.caller);
    let a = getOrCreate(msg.caller);
    compoundAccount(a);
  };

  public shared query (msg) func getTransactions() : async [Transaction] {
    requireAuthed(msg.caller);
    switch (accounts.get(msg.caller)) {
      case (?a) Buffer.toArray(a.transactions);
      case null [];
    };
  };

  public query func getFees() : async { networkFee : Nat; withdrawalFee : Nat } {
    { networkFee; withdrawalFee };
  };

  public query func getLimits() : async {
    maxTxAmount : Nat;
    maxTxLog : Nat;
    minOpIntervalNs : Int;
    accrueInterest : Bool;
  } {
    {
      maxTxAmount = MAX_TX_AMOUNT;
      maxTxLog = MAX_TX_LOG;
      minOpIntervalNs = MIN_OP_INTERVAL_NS;
      accrueInterest;
    };
  };

  // ─── Ledger introspection (new in PR11.1) ───────────────────────────────
  // Returns the ICRC-1 account where this user should send ICP to top up.
  // Owner is the dbank canister's principal; subaccount is derived from the
  // caller's principal so funds remain segregated per user.
  public shared query (msg) func getDepositAccount() : async LedgerAccount {
    requireAuthed(msg.caller);
    {
      owner = Principal.fromActor(self);
      subaccount = ?subaccountFor(msg.caller);
    };
  };

  // Echoes back the configured ledger canister so the frontend / explorers
  // can verify which ledger this canister speaks to.
  public query func getLedgerCanister() : async Principal {
    ledgerPrincipal;
  };

  // ─── Deposit reconciliation (PR11.2) ────────────────────────────────────
  //
  // Reconciles the caller's on-ledger deposit subaccount against their
  // internal balance. Called after the user transfers ICP to their deposit
  // address. Idempotent: if no new ICP arrived since the last call, returns
  // #ok(0).
  //
  // Race-condition story: two simultaneous notifies snapshot the ledger
  // balance independently, but only one's `await` completes first. That
  // continuation advances `lastSeenLedgerBalance` to the snapshot value.
  // The second continuation then sees `onLedger <= lastSeenLedgerBalance`
  // and returns #ok(0). Idempotent without explicit locking.
  public type NotifyError = {
    #rateLimited : { retryAfterNs : Int };
    #ledgerUnreachable : { message : Text };
  };

  public shared (msg) func notifyDeposit() : async Result<Nat, NotifyError> {
    requireAuthed(msg.caller);
    let a = getOrCreate(msg.caller);
    let wait = rateLimitWait(a);
    if (wait > 0) return #err(#rateLimited({ retryAfterNs = wait }));

    let onLedger : Nat = try {
      await ledger.icrc1_balance_of({
        owner = Principal.fromActor(self);
        subaccount = ?subaccountFor(msg.caller);
      });
    } catch (err) {
      return #err(#ledgerUnreachable({ message = debug_show err }));
    };

    if (onLedger <= a.lastSeenLedgerBalance) {
      // No new deposits. Update lastOpAt anyway to consume rate-limit budget.
      a.lastOpAt := Time.now();
      return #ok(0);
    };

    let credit : Nat = onLedger - a.lastSeenLedgerBalance;
    compoundAccount(a);
    a.balance += credit;
    a.lastSeenLedgerBalance := onLedger;
    recordTx(a, #deposit, credit, 0);
    #ok(credit);
  };
};
