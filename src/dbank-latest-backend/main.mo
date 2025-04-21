import Debug "mo:base/Debug";
import Nat "mo:base/Nat";
import Time "mo:base/Time";
import Float "mo:base/Float";

actor DBank {
  stable var currentValue : Float = 300;
  currentValue := 300;

  stable var startTime = Time.now();
  // startTime := Time.now();
  Debug.print(debug_show (startTime));

  let id = 234902384;
  let networkFee : Float = 0.0005;
  let withdrawalFee : Float = 0.001;

  Debug.print(debug_show (currentValue));
  // Debug.print(debug_show (id));

  public func topUp(amount : Float) {
    if (amount > networkFee) {
      currentValue += (amount - networkFee);
      Debug.print(debug_show (currentValue));
    } else {
      Debug.print("Amount must be greater than network fee");
    };
  };

  public func withdraw(amount : Float) {
    let totalWithFee = amount + withdrawalFee;
    if (currentValue < totalWithFee) {
      Debug.print("Insufficient funds including fee");
    } else {
      currentValue -= totalWithFee;
      Debug.print(debug_show (currentValue));
    };
  };

  public query func checkBalance() : async Float {
    return currentValue;
  };

  public func getID() : async Nat {
    return id;
  };

  public func compound() {
    let currentTime = Time.now();
    let timeElapsedNS = currentTime - startTime;
    let timeElapsedS = timeElapsedNS / 1000000000;

    // Calculate rate that compounds to exactly 1% daily
    // 1.01 = target daily multiplier (1% increase)
    // 1/86400 = one second as fraction of a day
    // (1.01 ^ (1/86400)) = per-second rate for 1% daily
    let perSecondRate = 1.01 ** (1.0 / 86400.0);
    currentValue := currentValue * (perSecondRate ** Float.fromInt(timeElapsedS));
    startTime := currentTime;
  };

  public query func greet(name : Text) : async Text {
    return "Hello, " # name # "!";
  };
};
