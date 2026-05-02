#!/usr/bin/env bash
# scripts/local-ledger-setup.sh
#
# One-shot setup for local dbank development. Brings up a clean local
# replica, pulls + deploys the ICP ledger and Internet Identity, mints
# some local ICP to a test identity, and deploys dbank against the
# local ledger.
#
# Usage:
#   ./scripts/local-ledger-setup.sh                 # default: alice gets 100 ICP
#   ./scripts/local-ledger-setup.sh bob 250         # bob gets 250 ICP
#
# Idempotent: re-running tears down + rebuilds. Safe to abort and re-run.

set -euo pipefail

USER_NAME="${1:-alice}"
INITIAL_ICP="${2:-100}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

command -v dfx >/dev/null || fail "dfx not found on PATH. Install: https://internetcomputer.org/docs/current/developer-docs/setup/install"
command -v jq  >/dev/null || warn "jq not found — output parsing will be less pretty (script still works)"

# ─── 1. Replica ───────────────────────────────────────────────────────────
step "Restarting local replica with --clean"
dfx stop >/dev/null 2>&1 || true
dfx start --background --clean

# ─── 2. Identities ────────────────────────────────────────────────────────
step "Ensuring 'minter' and '$USER_NAME' identities exist"
for id in minter "$USER_NAME"; do
  if ! dfx identity list 2>&1 | grep -q "^$id$"; then
    dfx identity new "$id" --storage-mode plaintext
  fi
done

MINTER_ACCOUNT="$(dfx ledger account-id --identity minter)"
USER_PRINCIPAL="$(dfx --identity "$USER_NAME" identity get-principal)"
echo "  minter account-id : $MINTER_ACCOUNT"
echo "  $USER_NAME principal     : $USER_PRINCIPAL"

# ─── 3. Pulled deps (II + ICP ledger) ─────────────────────────────────────
step "Pulling Internet Identity + ICP ledger via 'dfx deps'"
dfx deps pull

# Internet Identity init: empty record is fine for local.
dfx deps init internet_identity --argument '(null)' >/dev/null 2>&1 || true

# ICP ledger init: tell it to mint to our minter, no initial balances.
dfx deps init icp_ledger_canister --argument "(variant {
  Init = record {
    minting_account = \"$MINTER_ACCOUNT\";
    initial_values = vec {};
    send_whitelist = vec {};
    transfer_fee = opt record { e8s = 10_000 : nat64 };
    token_symbol = opt \"LICP\";
    token_name = opt \"Local ICP\";
  }
})"

dfx deps deploy

LEDGER_ID="$(dfx canister id icp_ledger_canister)"
echo "  Local ICP ledger : $LEDGER_ID"

# ─── 4. dbank-latest-backend ──────────────────────────────────────────────
step "Deploying dbank-latest-backend pointed at the local ledger"
dfx deploy dbank-latest-backend --argument "(opt record {
  ledger = principal \"$LEDGER_ID\"
})"

DBANK_ID="$(dfx canister id dbank-latest-backend)"
echo "  dbank canister    : $DBANK_ID"

# Sanity check: the canister should report the local ledger we just deployed.
REPORTED_LEDGER="$(dfx canister call dbank-latest-backend getLedgerCanister | tr -d ' ()principal\"')"
if [ "$REPORTED_LEDGER" != "$LEDGER_ID" ]; then
  fail "dbank reports ledger=$REPORTED_LEDGER but expected $LEDGER_ID"
fi

# ─── 5. Mint test ICP to $USER_NAME ───────────────────────────────────────
step "Minting $INITIAL_ICP ICP to $USER_NAME"
USER_ACCOUNT_ID="$(dfx --identity "$USER_NAME" ledger account-id)"
dfx --identity minter ledger transfer \
  --amount "$INITIAL_ICP" \
  --memo 0 \
  "$USER_ACCOUNT_ID" >/dev/null

USER_BALANCE="$(dfx --identity "$USER_NAME" ledger balance)"
echo "  $USER_NAME balance       : $USER_BALANCE"

# ─── 6. Done ──────────────────────────────────────────────────────────────
step "Setup complete"
cat <<EOF

Try it:

  # Get the deposit address for $USER_NAME
  dfx --identity $USER_NAME canister call dbank-latest-backend getDepositAccount

  # Send 5 ICP from $USER_NAME's account to dbank's deposit subaccount
  # (requires the legacy AccountIdentifier form of the deposit subaccount —
  # extract it manually for now)

  # Then notify the canister
  dfx --identity $USER_NAME canister call dbank-latest-backend notifyDeposit

  # Or run the full automated checklist:
  ./scripts/verify-pr11.sh $USER_NAME

EOF
