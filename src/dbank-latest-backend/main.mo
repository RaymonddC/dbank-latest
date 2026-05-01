import Buffer "mo:base/Buffer";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import TrieMap "mo:base/TrieMap";

actor DBank {
  // 1 ICP = 100_000_000 e8s. All on-chain amounts are Nat e8s.
  let E8S_PER_ICP : Nat = 100_000_000;
  let networkFee : Nat = 50_000;       // 0.0005 ICP
  let withdrawalFee : Nat = 100_000;   // 0.001  ICP

  // Per-second rate that compounds to exactly 1% daily: 1.01 ^ (1/86400).
  let perSecondRate : Float = 1.01 ** (1.0 / 86400.0);

  // Cap a single compound step to one year — past that the Float math
  // would overflow toward Inf and Float.toInt would trap. If a wallet is
  // dormant for years the next interaction credits one year of interest;
  // subsequent calls catch up.
  let MAX_COMPOUND_ELAPSED_S : Int = 31_536_000;

  // Per-principal transaction log size cap. Older entries are evicted.
  let MAX_TX_LOG : Nat = 100;

  // Minimum interval between any two ops from the same principal (anti-spam).
  let MIN_OP_INTERVAL_NS : Int = 100_000_000; // 100 ms

  // Hard ceiling on a single tx amount: 1B ICP. Anything larger is clearly
  // hostile or a bug, and capping prevents Float-precision oddities.
  let MAX_TX_AMOUNT : Nat = 1_000_000_000 * E8S_PER_ICP;

  public type TransactionKind = { #topUp; #withdraw };

  public type Transaction = {
    kind : TransactionKind;
    amount : Nat;       // e8s
    fee : Nat;          // e8s
    balanceAfter : Nat; // e8s
    timestamp : Int;    // nanoseconds since epoch
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

  // Returns the time the caller must wait before another op, or 0 if free.
  func rateLimitWait(a : Account) : Int {
    let now = Time.now();
    let next = a.lastOpAt + MIN_OP_INTERVAL_NS;
    if (now >= next) 0 else (next - now);
  };

  // Compound the account's balance by the time elapsed since lastCompoundedAt.
  // Float math is used internally; the result is rounded back to Nat e8s.
  // Caps elapsed to MAX_COMPOUND_ELAPSED_S to prevent Float overflow.
  func compoundAccount(a : Account) {
    let now = Time.now();
    let rawElapsed : Int = (now - a.lastCompoundedAt) / 1_000_000_000;
    let elapsedS : Int = if (rawElapsed > MAX_COMPOUND_ELAPSED_S) MAX_COMPOUND_ELAPSED_S else rawElapsed;
    if (elapsedS > 0 and a.balance > 0) {
      let asFloat = Float.fromInt(a.balance);
      let multiplied = asFloat * (perSecondRate ** Float.fromInt(elapsedS));
      a.balance := Int.abs(Float.toInt(multiplied));
      // Advance the anchor only by the time we actually credited; the next
      // call will pick up the remainder if rawElapsed was capped.
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

};
