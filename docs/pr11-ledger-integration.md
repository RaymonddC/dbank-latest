# PR11 — Real ICP Ledger Integration

> **Status: shipped.** PR11.1–PR11.4 landed as four stacked commits on the
> dbank PR ladder:
>
> | Sub-PR  | Commit    | What it shipped |
> |---------|-----------|-----------------|
> | PR11.1  | `507ea92` | Actor class with init args, ICRC-1 types, `subaccountFor`, `getDepositAccount`, `getLedgerCanister`, frontend ICRC-1 textual encoder + `<DepositAddress />` |
> | PR11.2  | `cf390d6` | `lastSeenLedgerBalance`, `notifyDeposit() : Result<Nat, NotifyError>`, `#deposit` transaction kind, frontend "Notify deposit" button |
> | PR11.3  | `4c4b95c` | `withdraw(amount, dest)` via real `icrc1_transfer`, `#ledgerError` + `#ledgerUnreachable` variants, race-safe pre-decrement of `lastSeenLedgerBalance` before the await, ICRC-1 destination input on the withdraw form |
> | PR11.4  | `1657d4e` | `accrueInterest` flag (default `false`), `compoundAccount` no-op in custody mode, `useLimits()` hook, conditional landing copy |
>
> The §11 verification gates are now automated by `scripts/verify-pr11.sh`
> (PR13, commit `0cf975e`). The §10 sub-PR split exists as actual branches:
> `pr11.1-ledger-plumbing`, `pr11.2-notify-deposit`, `pr11.3-real-withdraw`,
> `pr11.4-disable-simulation-interest`.
>
> **Still open** (§14): reserve funding strategy for re-enabling interest
> in production, per-user deposit caps, withdrawal-address whitelist,
> off-chain monitoring. None of these are blockers for using custody
> mode as-is.
>
> The technical content below — architecture, race conditions, mainnet
> + rollback checklists — is unchanged and remains the reference.

---

This is the plan + verification checklist for replacing the simulated balances in
`src/dbank-latest-backend` with custody of real ICP held in the ICP ledger
canister. It assumes PR1–PR10 + PR12 are merged.

The work is genuinely risky (real money on mainnet, inter-canister calls, race
conditions), so this doc is opinionated about doing it as a **stack of 4 small
PRs** rather than one big one, with verification gates between each step.

---

## 1. Goal & non-goals

**In scope**

- Each user has a unique deposit address derived from their Principal.
- A user can send ICP from any wallet (NNS, Plug, OISY) to that address, then
  notify dbank, which credits the new deposit to their internal balance.
- A user can withdraw to any ICRC-1 account; dbank performs an actual
  `icrc1_transfer` from the user's deposit subaccount.
- Compounding interest still runs, but it's now interest *paid out of the
  canister's reserves* — see §7 about where the ICP for interest comes from.
- All flows work locally against a `dfx deps`–pulled ICP ledger canister.

**Out of scope (defer to follow-up PRs)**

- Mainnet deployment. This plan describes mainnet setup; actual deploy is a
  separate decision.
- ckBTC / ckETH / multi-asset support.
- Anything paying out interest from a real funded reserve. Until that's solved,
  interest accrual on real-money deposits is misleading and must be disabled
  (or the canister must be pre-funded — see §7).
- Notifications / webhooks on deposit confirmation.

---

## 2. Prerequisites

You'll need the following set up locally before starting:

```bash
dfx --version            # 0.24+ recommended
mops --version           # for any future mops test work
node --version           # 22+ matches CI
```

Two terminal windows are easiest:

- Terminal A runs `dfx start --background --clean` and stays put.
- Terminal B runs build/deploy/test commands.

---

## 3. Architecture

```
┌────────────────────────────┐                      ┌──────────────────────────────┐
│  Browser (frontend)        │  signed update calls │  dbank-latest-backend (us)   │
│  ───────────────────────── │ ───────────────────► │  ───────────────────────────│
│  - signs in via II         │                      │  - per-Principal accounts    │
│  - reads deposit address   │ ◄─── candid query ── │    { balance, lastSeen,      │
│  - shows balance           │                      │      pending, txs }          │
│  - calls topUp / withdraw  │                      │                              │
└────────────────────────────┘                      │  inter-canister calls below  │
                                                    └──────────────┬───────────────┘
                                                                   │
                                              icrc1_balance_of    │   icrc1_transfer
                                                                   ▼
                                                    ┌──────────────────────────────┐
                                                    │  ICP ledger canister         │
                                                    │   (ryjl3-tyaaa-aaaaa-aaaba-  │
                                                    │    cai on mainnet)           │
                                                    └──────────────────────────────┘
```

Key idea: dbank is the *owner* on the ICRC-1 ledger. Each user gets a unique
**subaccount** under dbank's principal. ICP destined for user U lives at
account `(owner = dbank-canister-id, subaccount = subaccountFor(U))`. dbank can
move ICP between subaccounts and out to external destinations, because it
controls every subaccount under its own principal.

---

## 4. Subaccount derivation

A subaccount is a 32-byte blob.  Derive it deterministically from the user's
Principal by left-padding the principal blob with zero bytes to 32 bytes:

```motoko
import Blob "mo:base/Blob";
import Array "mo:base/Array";
import Nat8 "mo:base/Nat8";

func subaccountFor(user : Principal) : [Nat8] {
  let bytes = Blob.toArray(Principal.toBlob(user));
  Array.tabulate<Nat8>(32, func(i) {
    if (i < bytes.size()) bytes[i] else (0 : Nat8);
  });
};
```

Reasons to use zero-pad rather than a hash:

- It's deterministic and reversible (we can recover the principal on inspection).
- It matches the convention used by NNS-Dapp / cycles wallet / OISY for
  sub-account-per-user designs.

A single principal blob is at most 29 bytes, so 32-byte zero-padding is safe.

---

## 5. dfx setup for local ledger

### 5.1 Add the ledger to `dfx.json`

```jsonc
{
  "canisters": {
    "dbank-latest-backend": { "type": "motoko", "main": "src/.../main.mo" },
    "dbank-latest-frontend": { /* unchanged */ },
    "internet_identity":      { "type": "pull", "id": "rdmx6-jaaaa-aaaaa-aaadq-cai" },
    "icp_ledger_canister":    { "type": "pull", "id": "ryjl3-tyaaa-aaaaa-aaaba-cai" }
  }
}
```

### 5.2 Pull and initialise

```bash
dfx deps pull
# The ledger needs an init record; dfx prompts via:
dfx deps init icp_ledger_canister --argument "(variant {
  Init = record {
    minting_account = \"$(dfx ledger account-id --identity minter)\";
    initial_values = vec {};
    send_whitelist = vec {};
    transfer_fee = opt record { e8s = 10_000 : nat64 };
    token_symbol = opt \"LICP\";
    token_name = opt \"Local ICP\";
  }
})"
dfx deps deploy
```

### 5.3 Mint test ICP into a user identity

```bash
dfx identity new alice --storage-mode plaintext  # local-only test identity
dfx ledger transfer \
  --identity minter \
  --amount 100 \
  --memo 0 \
  "$(dfx ledger account-id --identity alice)"
dfx ledger balance --identity alice  # should show ~100
```

---

## 6. Backend changes (src/dbank-latest-backend/main.mo)

### 6.1 ICRC-1 type definitions

```motoko
public type Subaccount = [Nat8];

public type Account = {
  owner : Principal;
  subaccount : ?Subaccount;
};

public type TransferArgs = {
  from_subaccount : ?Subaccount;
  to : Account;
  amount : Nat;
  fee : ?Nat;
  memo : ?[Nat8];
  created_at_time : ?Nat64;
};

public type TransferResult = { #Ok : Nat; #Err : TransferLedgerError };

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

public type Ledger = actor {
  icrc1_balance_of : (Account) -> async Nat;
  icrc1_transfer : (TransferArgs) -> async TransferResult;
  icrc1_fee : () -> async Nat;
};
```

### 6.2 Init args + ledger handle

```motoko
actor class DBank(initArgs : { ledger : Principal }) = self {
  let ledger : Ledger = actor (Principal.toText(initArgs.ledger));
  // ...
};
```

In `dfx.json` the canister deploys with:

```bash
dfx deploy dbank-latest-backend --argument "(record {
  ledger = principal \"$(dfx canister id icp_ledger_canister)\"
})"
```

### 6.3 Account model — add `lastSeenLedgerBalance`

The PR4 `Account` becomes:

```motoko
type Account = {
  var balance : Nat;                    // internal balance in e8s
  var lastSeenLedgerBalance : Nat;      // last reconciled ledger balance
  var lastCompoundedAt : Int;
  var lastOpAt : Int;
  transactions : Buffer.Buffer<Transaction>;
};
```

`StableAccount` mirrors with the same field. Bump the upgrade hooks.

### 6.4 `getDepositAccount` query

```motoko
public shared query (msg) func getDepositAccount() : async Account {
  requireAuthed(msg.caller);
  {
    owner = Principal.fromActor(self);
    subaccount = ?subaccountFor(msg.caller);
  };
};
```

### 6.5 `notifyDeposit`

```motoko
public shared (msg) func notifyDeposit() : async Result<Nat, Text> {
  requireAuthed(msg.caller);
  let a = getOrCreate(msg.caller);
  let wait = rateLimitWait(a);
  if (wait > 0) return #err("Rate limited");

  // Snapshot the ledger balance under the caller's deposit subaccount.
  let onLedger = await ledger.icrc1_balance_of({
    owner = Principal.fromActor(self);
    subaccount = ?subaccountFor(msg.caller);
  });

  // The diff vs lastSeen is the new credit. Idempotent: if two notifies
  // race, the second sees no diff because the first already advanced
  // lastSeenLedgerBalance.
  if (onLedger <= a.lastSeenLedgerBalance) {
    return #ok(0);
  };
  let credit = onLedger - a.lastSeenLedgerBalance;
  compoundAccount(a);
  a.balance += credit;
  a.lastSeenLedgerBalance := onLedger;
  recordTx(a, #topUp, credit, 0);
  #ok(credit);
};
```

### 6.6 `withdraw(amount, dest)` with real transfer

```motoko
public shared (msg) func withdraw(amount : Nat, dest : Account)
  : async Result<Nat, TransferError> {

  requireAuthed(msg.caller);
  if (amount == 0) return #err(#invalidAmount);
  if (amount > MAX_TX_AMOUNT) return #err(#amountTooLarge({ max = MAX_TX_AMOUNT }));

  let a = getOrCreate(msg.caller);
  let wait = rateLimitWait(a);
  if (wait > 0) return #err(#rateLimited({ retryAfterNs = wait }));

  compoundAccount(a);

  let ledgerFee = await ledger.icrc1_fee();
  let totalNeeded = amount + ledgerFee;
  if (a.balance < totalNeeded) {
    return #err(#insufficientFunds({ balance = a.balance; required = totalNeeded }));
  };

  // Reserve before the call. If the call traps, post-trap state rolls back
  // automatically (Motoko orthogonal persistence). If the call returns #Err,
  // we explicitly refund.
  a.balance -= totalNeeded;
  a.lastOpAt := Time.now();

  let result = await ledger.icrc1_transfer({
    from_subaccount = ?subaccountFor(msg.caller);
    to = dest;
    amount;
    fee = ?ledgerFee;
    memo = null;
    created_at_time = null;
  });

  switch (result) {
    case (#Ok blockIndex) {
      a.lastSeenLedgerBalance -= totalNeeded;
      recordTx(a, #withdraw, amount, ledgerFee);
      #ok(blockIndex);
    };
    case (#Err err) {
      // Refund — the ledger rejected the transfer.
      a.balance += totalNeeded;
      #err(#ledgerError(err));
    };
  };
};
```

`TransferError` gains a `#ledgerError : TransferLedgerError` variant.

### 6.7 Drop `topUp(amount)` (the simulation entry point)

The old `topUp` lied — it minted internal balance with no real ICP behind it.
Delete it. Front-end users now top up via real ledger transfer + `notifyDeposit`.

For dev convenience you can keep a `controllerOnly` cheat that lets the
canister controller mint internal balance for testing. Gate it with
`assert msg.caller == controller`.

---

## 7. Where does interest come from?

This is the ugly question that simulation hid. With real money in the ledger,
1% daily compound has to come from somewhere:

- **Option A: pre-funded reserve.** Mint extra ICP to the canister's main
  account (subaccount = none). Internal-balance interest is paid by drawing
  from that reserve. Interest stops working when the reserve runs out.
- **Option B: turn off interest.** Disable `compoundAccount`. Internal balance
  is just a 1:1 claim on real ICP. Cleanest but kills the whole demo premise.
- **Option C: pay interest in cycles + UI shows accrual but withdraws are
  capped at deposited amount.** Misleading.

For a real product, A is correct but you must monitor reserve drawdown. For
this demo, the realistic move is to **disable interest in the same PR that
flips on real custody**. Adding a real reserve is its own follow-up.

The plan below assumes interest is disabled when ledger custody is on, gated
by an `accrueInterest : Bool` config flag in the canister state.

---

## 8. Frontend changes

### 8.1 New deposit panel (replaces the top-up form)

`src/dbank-latest-frontend/src/components/DepositPanel.tsx`:

- Calls `dbank.getDepositAccount()` once per signed-in principal.
- Renders:
  - The owner principal + base32-encoded subaccount in monospace
  - The full ICRC-1 textual form (`<owner>-<crc>.<subaccount-hex>`)
  - A copy button on each
  - A QR code (optional, deferred — `qrcode.react` package)
  - A "I've sent ICP" button → calls `notifyDeposit()`, shows toast with
    credited amount or "no new deposits found".

### 8.2 Withdraw form gains a destination field

- Input: ICRC-1 textual account string. Parse with `@icp-sdk/core/icrc1`'s
  account decoder if available, otherwise:
  ```ts
  function parseIcrc1Account(s: string): Account { /* base32 decode */ }
  ```
  Validate before submit.
- On submit, call `withdraw(amountE8s, parsedAccount)`.

### 8.3 Update `describeTransferError`

Add a branch for `#ledgerError`. Map each ICRC-1 error variant to friendly
copy:

```ts
if ('ledgerError' in err) {
  const e = (err as { ledgerError: any }).ledgerError;
  if ('InsufficientFunds' in e) return 'Ledger reports insufficient funds';
  if ('BadFee' in e)            return `Bad ledger fee (expected ${e.BadFee.expected_fee})`;
  if ('TemporarilyUnavailable' in e) return 'Ledger temporarily unavailable — retry';
  // ...
}
```

Add a vitest case for each variant in `transferErrors.test.ts`.

### 8.4 Real ICP icon for accuracy

Drop the simulated "Top Up" verb in copy in favour of "Deposit ICP" /
"Withdraw ICP" everywhere. Header CTA stays "Connect Wallet".

---

## 9. Race conditions & edge cases (read this twice)

| # | Scenario | Mitigation |
|---|----------|-----------|
| R1 | User notifies, then notifies again before first finishes | The second await sees the same `lastSeenLedgerBalance`; only one ends up advancing it. Second call returns 0 credited. ✓ Already idempotent. |
| R2 | User deposits, notifies, then deposits more, then notifies | First notify credits delta1, advances lastSeen. Second notify credits delta2. Both credits are recorded. ✓ |
| R3 | User starts withdraw, then notifies a deposit before transfer returns | `withdraw` already deducted from internal balance and from `lastSeenLedgerBalance` after `#Ok`. The notify between the two awaits sees `onLedger > lastSeen` and would over-credit. **Mitigation:** in `withdraw`, decrement `lastSeenLedgerBalance` *before* the `await`, then if the transfer fails, increment it back. |
| R4 | Two browsers withdraw at once | Both pass the balance check, both call ledger. The ledger serialises. Whichever loses the second ICRC-1 transfer fails with `InsufficientFunds`; we refund. |
| R5 | Canister upgraded between `await` and continuation | Motoko's orthogonal persistence preserves stable state but in-flight messages may be replayed. Use `created_at_time` + `memo` based deduplication on the ledger side, or accept that the upgrade window is a known footgun and document it. |
| R6 | `icrc1_balance_of` returns less than `lastSeenLedgerBalance` (e.g. someone moved ICP out using an external tool) | Treat the diff as zero (don't underflow `Nat`). Log it. The user has lost custody-of-record because they bypassed dbank. |
| R7 | Ledger fee changes between read and transfer | We pass `fee = ?ledgerFee` reading at start of `withdraw`. Ledger compares; on mismatch returns `#BadFee` which we surface. User retries. |

---

## 10. Sub-PRs (recommended split)

Doing this in one PR is dangerous. Split it:

### PR11.1 — Ledger plumbing (no user-facing change)
- dfx.json adds `icp_ledger_canister` pull
- Add ICRC-1 types to `main.mo`
- Add ledger handle, but no methods that use it yet
- Add `subaccountFor`, `getDepositAccount` query
- Frontend reads `getDepositAccount` and displays it (no actions yet)
- **Verify:** `dfx deps deploy` works; `dfx canister call dbank-latest-backend getDepositAccount` returns the expected `{owner; subaccount}`.

### PR11.2 — `notifyDeposit` (deposit side only)
- Add `lastSeenLedgerBalance` field
- Add `notifyDeposit` update
- Frontend: replace simulated top-up form with deposit address + "I've sent ICP" button
- Bump test coverage
- **Verify:** mint to alice → `dfx ledger transfer alice → dbank's subaccountFor(alice)` → call `notifyDeposit` → balance shows expected credit.

### PR11.3 — Real `withdraw` with `icrc1_transfer`
- Replace simulated `withdraw` with the version in §6.6
- Add `#ledgerError` variant to `TransferError`
- Frontend: add destination input + parser
- Bump test coverage for new error variants
- **Verify:** alice deposits → withdraws to bob → bob's balance increases by amount, alice's internal balance decreases by amount + fee.

### PR11.4 — Disable simulation interest in custody mode
- Add `accrueInterest : Bool` flag in canister state
- Skip `compoundAccount` body when flag is false
- Update copy on landing (no more "1% daily" claim)
- **Verify:** `getLimits` reflects the flag.

Each sub-PR is reviewable on its own and ships behind the prior one.

---

## 11. Verification checklist

Before merging PR11.1:

```bash
[ ] dfx start --background --clean
[ ] dfx deps pull && dfx deps init && dfx deps deploy
[ ] dfx deploy dbank-latest-backend --argument '(record { ledger = principal "<id>" })'
[ ] dfx canister call dbank-latest-backend getDepositAccount
    → returns { owner = <dbank-canister>; subaccount = opt blob "..." }
[ ] Frontend: sign in as alice, deposit address renders, copy button works
```

Before merging PR11.2:

```bash
[ ] dfx ledger transfer alice → <dbank>.<sub-of-alice> 5 ICP
[ ] dfx canister call dbank-latest-backend notifyDeposit (as alice)
    → #ok(500_000_000)
[ ] checkBalance returns 500_000_000
[ ] Calling notifyDeposit again returns #ok(0) — idempotent
[ ] Send another 1 ICP → notify → returns #ok(100_000_000)
```

Before merging PR11.3:

```bash
[ ] alice has 5 ICP internal balance
[ ] withdraw 1 ICP to bob's account
    → #ok(<block-index>)
[ ] dfx ledger balance --identity bob shows ≈ 1 ICP
[ ] checkBalance for alice shows ≈ 4 ICP - 0.0001 fee
[ ] Withdraw with bad address → #err(#ledgerError(...))
[ ] Withdraw exceeding balance → #err(#insufficientFunds(...))
```

Before merging PR11.4:

```bash
[ ] Wait 60s, checkBalance unchanged (interest disabled)
[ ] Landing copy no longer claims "1% daily"
```

---

## 12. Mainnet deployment

Do **not** deploy until all 4 sub-PRs are merged + manually tested locally.

```bash
# 1. Confirm controller identity
dfx identity get-principal --identity production

# 2. Reproducible build
dfx build --network ic --check
sha256sum .dfx/ic/canisters/dbank-latest-backend/dbank-latest-backend.wasm.gz
# Compare to CI artefact hash

# 3. Deploy with mainnet ledger id
dfx deploy --network ic dbank-latest-backend --argument '(record {
  ledger = principal "ryjl3-tyaaa-aaaaa-aaaba-cai"
})'

# 4. Verify with smoke tests:
[ ] getDepositAccount returns the expected subaccount for your principal
[ ] notifyDeposit with no real deposit returns #ok(0)
[ ] (Optional) deposit a tiny amount, verify credit, withdraw it back
```

If anything looks off, **uninstall the canister** before users find it:

```bash
dfx canister --network ic stop dbank-latest-backend
```

Cycles will keep the canister alive but it won't accept calls.

---

## 13. Rollback plan

Each sub-PR is reversible by reverting its commit. The only state migration
is in PR11.2 (adds `lastSeenLedgerBalance` to `StableAccount`). To roll back:

1. Revert the commit.
2. Re-deploy.
3. The pre-upgrade hook will serialise the new field; the post-upgrade
   constructor on the older code will ignore it (Motoko stable variables
   tolerate field removal). Verified pattern: see PR1's StableAccount setup.

If you need to roll back *after* real ICP has been deposited, you can't —
those balances are in the ledger under dbank's subaccounts and the only way
to recover them is via the canister. So: be sure before deploying PR11.3
to mainnet.

---

## 14. Open questions for you to decide

- **Reserve funding strategy.** If you do want to keep the 1% interest claim
  honest, pre-fund the canister with enough ICP to cover N years of expected
  user deposits at 1% daily. Set up a monitor that pings reserve balance.
- **Per-user deposit cap.** Should there be one? With a fixed reserve, yes.
- **Withdrawal address whitelist.** Optional defense in depth.
- **Off-chain monitoring.** Probably want a small read-only watcher that
  polls `getLimits` + reserve balance + canister cycle balance, alerts on
  thresholds.

---

*Last updated alongside PR12 of the dbank stack. Reach for this doc the next
time you sit down to do PR11.*
