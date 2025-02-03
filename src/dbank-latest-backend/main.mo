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

  Debug.print(debug_show (currentValue));
  // Debug.print(debug_show (id));

  public func topUp(amount : Float) {
    currentValue += amount;
    Debug.print(debug_show (currentValue));
  };

  public func withdraw(amount : Float) {
    if (currentValue < amount) {
      Debug.print("Insufficient funds");
    } else {
      currentValue -= amount;
    };
    Debug.print(debug_show (currentValue));
  };

  public query func checkBalance() : async Float {
    // await Nat.sleep(1000);
    return currentValue;
  };

  public func getID() : async Nat {
    return id;
  };

  public func compound() {
    let currentTime = Time.now();
    let timeElapsedNS = currentTime - startTime;
    let timeElapsedS = timeElapsedNS / 1000000000;
    currentValue := currentValue * (1.0001 ** Float.fromInt(timeElapsedS));
    startTime := currentTime;
  };

  public query func greet(name : Text) : async Text {
    return "Hello, " # name # "!";
  };
};
