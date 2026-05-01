import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Principal "mo:base/Principal";
import Time "mo:base/Time";
import TrieMap "mo:base/TrieMap";

actor DBank {
  type Account = {
    var balance : Float;
    var lastCompoundedAt : Int;
  };

  type StableAccount = {
    balance : Float;
    lastCompoundedAt : Int;
  };

  stable var accountEntries : [(Principal, StableAccount)] = [];

  let accounts = TrieMap.TrieMap<Principal, Account>(Principal.equal, Principal.hash);

  for ((p, sa) in accountEntries.vals()) {
    accounts.put(p, { var balance = sa.balance; var lastCompoundedAt = sa.lastCompoundedAt });
  };

  let networkFee : Float = 0.0005;
  let withdrawalFee : Float = 0.001;
  // Per-second rate that compounds to exactly 1% daily: 1.01 ^ (1/86400).
  let perSecondRate : Float = 1.01 ** (1.0 / 86400.0);

  system func preupgrade() {
    let buf = Buffer.Buffer<(Principal, StableAccount)>(accounts.size());
    for ((p, a) in accounts.entries()) {
      buf.add((p, { balance = a.balance; lastCompoundedAt = a.lastCompoundedAt }));
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
          var balance = 0.0;
          var lastCompoundedAt = Time.now();
        };
        accounts.put(p, a);
        a;
      };
    };
  };

  func compoundAccount(a : Account) {
    let now = Time.now();
    let elapsedS : Int = (now - a.lastCompoundedAt) / 1_000_000_000;
    if (elapsedS > 0) {
      a.balance := a.balance * (perSecondRate ** Float.fromInt(elapsedS));
      a.lastCompoundedAt := now;
    };
  };

  public shared (msg) func topUp(amount : Float) : async () {
    requireAuthed(msg.caller);
    let a = getOrCreate(msg.caller);
    compoundAccount(a);
    if (amount > networkFee) {
      a.balance += (amount - networkFee);
    } else {
      Debug.print("Amount must be greater than network fee");
    };
  };

  public shared (msg) func withdraw(amount : Float) : async () {
    requireAuthed(msg.caller);
    let a = getOrCreate(msg.caller);
    compoundAccount(a);
    let totalWithFee = amount + withdrawalFee;
    if (a.balance < totalWithFee) {
      Debug.print("Insufficient funds including fee");
    } else {
      a.balance -= totalWithFee;
    };
  };

  public shared query (msg) func checkBalance() : async Float {
    requireAuthed(msg.caller);
    switch (accounts.get(msg.caller)) {
      case (?a) a.balance;
      case null 0.0;
    };
  };

  public shared (msg) func compound() : async () {
    requireAuthed(msg.caller);
    let a = getOrCreate(msg.caller);
    compoundAccount(a);
  };

  public query func getID() : async Nat {
    234902384;
  };

  public query func getFees() : async { networkFee : Float; withdrawalFee : Float } {
    { networkFee; withdrawalFee };
  };
};
