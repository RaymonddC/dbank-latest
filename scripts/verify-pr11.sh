#!/usr/bin/env bash
# scripts/verify-pr11.sh
#
# Walks the verification checklists from docs/pr11-ledger-integration.md
# (PR11.1 → PR11.4) against a running local replica. Assumes
# scripts/local-ledger-setup.sh has been run.
#
# Usage:
#   ./scripts/verify-pr11.sh                     # default user: alice
#   ./scripts/verify-pr11.sh bob
#
# Exits non-zero on the first failed check.

set -euo pipefail

USER_NAME="${1:-alice}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

check() {
  local name="$1"
  local actual="$2"
  local expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  \033[1;32m✓\033[0m %s\n' "$name"
    PASS=$((PASS + 1))
  else
    printf '  \033[1;31m✗\033[0m %s\n      want: %s\n      got:  %s\n' "$name" "$expected" "$actual"
    FAIL=$((FAIL + 1))
  fi
}

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

command -v dfx >/dev/null || { echo "dfx not found"; exit 1; }

dfx ping >/dev/null 2>&1 || { echo "Local replica isn't running. Run scripts/local-ledger-setup.sh first."; exit 1; }

DBANK="dbank-latest-backend"
LEDGER_ID="$(dfx canister id icp_ledger_canister)"

# ─── PR11.1: deposit address + ledger introspection ───────────────────────
step "PR11.1 — ledger plumbing"

REPORTED_LEDGER="$(dfx canister call $DBANK getLedgerCanister | tr -d ' ()principal\"')"
check "getLedgerCanister echoes the local ledger" "$REPORTED_LEDGER" "$LEDGER_ID"

DEPOSIT_OUT="$(dfx --identity "$USER_NAME" canister call $DBANK getDepositAccount)"
echo "$DEPOSIT_OUT" | grep -q 'owner = principal' \
  && { printf '  \033[1;32m✓\033[0m getDepositAccount returns owner+subaccount\n'; PASS=$((PASS + 1)); } \
  || { printf '  \033[1;31m✗\033[0m getDepositAccount shape unexpected: %s\n' "$DEPOSIT_OUT"; FAIL=$((FAIL + 1)); }

# ─── PR11.2: notifyDeposit (no transfer yet) ──────────────────────────────
step "PR11.2 — notifyDeposit idempotency"

NOTIFY1="$(dfx --identity "$USER_NAME" canister call $DBANK notifyDeposit)"
echo "$NOTIFY1" | grep -q 'ok = 0' \
  && { printf '  \033[1;32m✓\033[0m notifyDeposit before any transfer returns ok=0\n'; PASS=$((PASS + 1)); } \
  || { printf '  \033[1;33m!\033[0m notifyDeposit baseline: %s (skipping idempotency)\n' "$NOTIFY1"; }

# Transfer 5 ICP from the user's account to the user's dbank deposit
# subaccount. This requires the AccountIdentifier (legacy) form of the
# subaccount — extract it via the principal bytes.
# For the demo, we instead use icrc1_transfer directly which is simpler.

DBANK_ID="$(dfx canister id $DBANK)"
USER_PRINCIPAL="$(dfx --identity "$USER_NAME" identity get-principal)"

step "Transferring 5 ICP from $USER_NAME to dbank's deposit subaccount via icrc1_transfer"

# subaccount = zero-padded principal blob (PR11 plan §4)
# dfx Candid-arg formatter would be painful here, so we use a tiny helper:
SUBACCOUNT_BLOB="$(node ./scripts/principal-to-subaccount.mjs "$USER_PRINCIPAL")"
echo "  subaccount = $SUBACCOUNT_BLOB"

TRANSFER_OUT="$(dfx --identity "$USER_NAME" canister call icp_ledger_canister icrc1_transfer "(record {
  from_subaccount = null;
  to = record {
    owner = principal \"$DBANK_ID\";
    subaccount = opt blob \"$SUBACCOUNT_BLOB\";
  };
  amount = 500_000_000 : nat;
  fee = null;
  memo = null;
  created_at_time = null;
})")"
echo "$TRANSFER_OUT" | grep -q '#Ok' \
  && { printf '  \033[1;32m✓\033[0m icrc1_transfer succeeded\n'; PASS=$((PASS + 1)); } \
  || { printf '  \033[1;31m✗\033[0m icrc1_transfer failed: %s\n' "$TRANSFER_OUT"; FAIL=$((FAIL + 1)); }

NOTIFY2="$(dfx --identity "$USER_NAME" canister call $DBANK notifyDeposit)"
echo "$NOTIFY2" | grep -q 'ok = 500_000_000' \
  && { printf '  \033[1;32m✓\033[0m notifyDeposit credits 5 ICP\n'; PASS=$((PASS + 1)); } \
  || { printf '  \033[1;31m✗\033[0m unexpected notifyDeposit result: %s\n' "$NOTIFY2"; FAIL=$((FAIL + 1)); }

NOTIFY3="$(dfx --identity "$USER_NAME" canister call $DBANK notifyDeposit)"
echo "$NOTIFY3" | grep -q 'ok = 0' \
  && { printf '  \033[1;32m✓\033[0m second notifyDeposit is idempotent (ok=0)\n'; PASS=$((PASS + 1)); } \
  || { printf '  \033[1;31m✗\033[0m notifyDeposit not idempotent: %s\n' "$NOTIFY3"; FAIL=$((FAIL + 1)); }

BAL="$(dfx --identity "$USER_NAME" canister call $DBANK checkBalance | tr -d ' ()_:nat')"
check "checkBalance reports 500_000_000 e8s" "$BAL" "500000000"

# ─── PR11.3: real withdraw via icrc1_transfer ─────────────────────────────
step "PR11.3 — withdraw via icrc1_transfer"

# Send 1 ICP back to the user's main account
USER_ACCOUNT_TEXT="$USER_PRINCIPAL"  # owner-only ICRC-1 textual form
WITHDRAW_OUT="$(dfx --identity "$USER_NAME" canister call $DBANK withdraw "(100_000_000 : nat, record {
  owner = principal \"$USER_PRINCIPAL\";
  subaccount = null;
})")"
echo "$WITHDRAW_OUT" | grep -q 'ok =' \
  && { printf '  \033[1;32m✓\033[0m withdraw 1 ICP returns block index\n'; PASS=$((PASS + 1)); } \
  || { printf '  \033[1;31m✗\033[0m withdraw failed: %s\n' "$WITHDRAW_OUT"; FAIL=$((FAIL + 1)); }

# ─── PR11.4: accrueInterest is off in custody mode ────────────────────────
step "PR11.4 — accrueInterest defaults to false"

LIMITS="$(dfx canister call $DBANK getLimits)"
echo "$LIMITS" | grep -q 'accrueInterest = false' \
  && { printf '  \033[1;32m✓\033[0m getLimits reports accrueInterest = false\n'; PASS=$((PASS + 1)); } \
  || { printf '  \033[1;31m✗\033[0m unexpected getLimits: %s\n' "$LIMITS"; FAIL=$((FAIL + 1)); }

# ─── Summary ──────────────────────────────────────────────────────────────
printf '\n\033[1m%d passed, %d failed\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
