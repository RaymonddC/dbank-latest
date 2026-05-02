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

## Verify PR11 end-to-end

```bash
./scripts/verify-pr11.sh           # default user: alice
./scripts/verify-pr11.sh bob       # custom user
```

Walks the verification gates from `docs/pr11-ledger-integration.md`:

- **PR11.1**: `getLedgerCanister` matches local ledger; `getDepositAccount`
  returns the expected owner + subaccount shape.
- **PR11.2**: `notifyDeposit` returns `ok = 0` baseline → `icrc1_transfer`
  5 ICP into the deposit subaccount → `notifyDeposit` returns
  `ok = 500_000_000` → second `notifyDeposit` returns `ok = 0`
  (idempotent) → `checkBalance` reports 5 ICP.
- **PR11.3**: `withdraw(1 ICP, user-account)` returns a ledger block index.
- **PR11.4**: `getLimits` reports `accrueInterest = false` (custody mode).

Exits non-zero on the first failed check.

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
