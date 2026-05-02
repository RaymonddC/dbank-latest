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

  // ─── App types (unchanged from PR9) ─────────────────────────────────────
  public type TransactionKind = { #topUp; #withdraw };

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
  };

  public type Result<T, E> = { #ok : T; #err : E };

  type Account = {
    var balance : Nat;
    var lastCompoundedAt : Int;
    var lastOpAt : Int;
    transactions : Buffer.Buffer<Transaction>;
  };

  type StableAccount = {
    balance : Nat;
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

  public shared (msg) func withdraw(amount : Nat) : async Result<(), TransferError> {
    requireAuthed(msg.caller);
    if (amount == 0) return #err(#invalidAmount);
    if (amount > MAX_TX_AMOUNT) return #err(#amountTooLarge({ max = MAX_TX_AMOUNT }));
    let a = getOrCreate(msg.caller);
    let wait = rateLimitWait(a);
    if (wait > 0) return #err(#rateLimited({ retryAfterNs = wait }));
    compoundAccount(a);
    let required = amount + withdrawalFee;
    if (a.balance < required) {
      return #err(#insufficientFunds({ balance = a.balance; required }));
    };
    a.balance -= required;
    recordTx(a, #withdraw, amount, withdrawalFee);
    #ok(());
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
  } {
    {
      maxTxAmount = MAX_TX_AMOUNT;
      maxTxLog = MAX_TX_LOG;
      minOpIntervalNs = MIN_OP_INTERVAL_NS;
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
};
