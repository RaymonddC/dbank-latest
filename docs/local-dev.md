# Local development quickstart

A 60-second loop for working on dbank end-to-end with a real local ICP ledger.

## Prerequisites

- `dfx` 0.24+ (`DFXVM_INIT_YES=true sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"`)
- `node` 22+ (for the frontend and the principal helper)

## One-shot setup

```bash
./scripts/local-ledger-setup.sh           # default: alice gets 100 ICP
./scripts/local-ledger-setup.sh bob 250   # custom user + amount
```

What it does:

1. Restarts the local replica with `--clean`.
2. Creates `minter` and `<user>` identities (idempotent).
3. Pulls + initialises Internet Identity and the ICP ledger via `dfx deps`.
4. Mints `<initial>` ICP from the minter to the user's account.
5. Deploys `dbank-latest-backend` pointed at the local ledger via init args
   (`(opt record { ledger = principal "<local-ledger-id>" })`).
6. Sanity-checks `getLedgerCanister` round-trips the local ledger id.

## Verify everything end-to-end

```bash
./scripts/e2e-test.sh              # default user: alice, recipient: bob
./scripts/e2e-test.sh carol dave   # custom identities
```

Walks ~30 assertions in 15 sections:

1. Read-only methods (`getFees`, `getLimits`, `getLedgerCanister`, `getController`) return sensible shapes.
2. Anonymous calls trap on every auth-required method.
3. Controller flow: claim once, re-claim fails, `setAccrueInterest` is gated.
4. `getDepositAccount` returns dbank-as-owner + per-user subaccount.
5. `notifyDeposit` baseline.
6. Real `icrc1_transfer` 5 ICP → user's deposit subaccount.
7. `notifyDeposit` credits 5 ICP, idempotent on re-call.
8. `checkBalance` reflects the credit.
9. `withdraw` 1 ICP → recipient's ledger balance grows by exactly 1 ICP.
10. Internal balance reflects (5 − 1 − 0.0001 fee).
11. Withdraw error variants: `#invalidAmount`, `#amountTooLarge`, `#insufficientFunds`.
12. Rate limiting: rapid second op → `#rateLimited` (or `ok=0`).
13. Withdraw refund on ledger reject.
14. `getTransactions` returns the expected `#deposit` + `#withdraw` entries.
15. Upgrade preserves balance + tx log + controller.

Exits non-zero on the first failed assertion. Pass/fail counts at the end.

`scripts/verify-pr11.sh` is the older, narrower script targeted just at
PR11.1–PR11.4 acceptance gates; `e2e-test.sh` supersedes it.

## Reset

```bash
dfx stop
./scripts/local-ledger-setup.sh    # back to clean state
```

## Helpers

`scripts/principal-to-subaccount.mjs <principal-text>` prints the Candid
blob literal payload (`\HH\HH...`) for a 32-byte zero-padded principal,
so you can paste subaccounts into ad-hoc `dfx canister call` arguments
without computing them by hand.

```bash
node scripts/principal-to-subaccount.mjs $(dfx --identity alice identity get-principal)
```
