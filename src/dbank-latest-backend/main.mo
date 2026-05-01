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
    #belowFee : { fee : Nat };
    #insufficientFunds : { balance : Nat; required : Nat };
  };

  public type Result<T, E> = { #ok : T; #err : E };

  type Account = {
    var balance : Nat;
    var lastCompoundedAt : Int;
    transactions : Buffer.Buffer<Transaction>;
  };

  type StableAccount = {
    balance : Nat;
    lastCompoundedAt : Int;
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
      transactions = txBuf;
    });
  };

  system func preupgrade() {
    let buf = Buffer.Buffer<(Principal, StableAccount)>(accounts.size());
    for ((p, a) in accounts.entries()) {
      buf.add((p, {
        balance = a.balance;
        lastCompoundedAt = a.lastCompoundedAt;
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
          transactions = Buffer.Buffer<Transaction>(8);
        };
        accounts.put(p, a);
        a;
      };
    };
  };

  // Compound the account's balance by the time elapsed since lastCompoundedAt.
  // Float math is used internally for the rate; the result is rounded back to
  // Nat e8s. Sub-e8 rounding loss is acceptable at this scale.
  func compoundAccount(a : Account) {
    let now = Time.now();
    let elapsedS : Int = (now - a.lastCompoundedAt) / 1_000_000_000;
    if (elapsedS > 0 and a.balance > 0) {
      let asFloat = Float.fromInt(a.balance);
      let multiplied = asFloat * (perSecondRate ** Float.fromInt(elapsedS));
      a.balance := Int.abs(Float.toInt(multiplied));
      a.lastCompoundedAt := now;
    } else if (elapsedS > 0) {
      a.lastCompoundedAt := now;
    };
  };

  func recordTx(a : Account, kind : TransactionKind, amount : Nat, fee : Nat) {
    a.transactions.add({
      kind;
      amount;
      fee;
      balanceAfter = a.balance;
      timestamp = Time.now();
    });
  };

  public shared (msg) func topUp(amount : Nat) : async Result<(), TransferError> {
    requireAuthed(msg.caller);
    if (amount == 0) return #err(#invalidAmount);
    if (amount <= networkFee) return #err(#belowFee({ fee = networkFee }));
    let a = getOrCreate(msg.caller);
    compoundAccount(a);
    a.balance += amount - networkFee;
    recordTx(a, #topUp, amount, networkFee);
    #ok(());
  };

  public shared (msg) func withdraw(amount : Nat) : async Result<(), TransferError> {
    requireAuthed(msg.caller);
    if (amount == 0) return #err(#invalidAmount);
    let a = getOrCreate(msg.caller);
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

  public query func getID() : async Nat {
    234902384;
  };

  public query func getFees() : async { networkFee : Nat; withdrawalFee : Nat } {
    { networkFee; withdrawalFee };
  };
};
