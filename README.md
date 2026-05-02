# dbank — Compounding wallet on the Internet Computer

A self-custody ICP wallet built on the Internet Computer. Pairs a Motoko
canister backend with a React + TypeScript frontend. Sign in with Internet
Identity, deposit ICP to a per-user subaccount on the ICP ledger, and
withdraw to any ICRC-1 account. Optional 1%-daily-compound interest mode
for demos (off by default — see [§ Interest mode](#interest-mode)).

## What it does

- **Sign in with Internet Identity.** No password, no off-chain accounts;
  delegations are time-bound (7 days) with a 30-minute idle auto-logout.
- **Per-user deposit subaccount.** `getDepositAccount()` returns the user's
  unique ICRC-1 account under the dbank canister. Send ICP from any
  ICRC-1 wallet (NNS dapp, OISY, Plug) to that address.
- **`notifyDeposit()` reconciles** the on-ledger balance against the user's
  internal balance. Idempotent — safe to call repeatedly.
- **Withdraw to any ICRC-1 account** via real `icrc1_transfer`. Returns
  the ledger block index on success; refunds internal balance on
  ledger-side failure.
- **Per-principal transaction log** capped at 100 entries, exportable as
  CSV from the UI.
- **Live-ticking balance** with 1%-daily compounding (when interest is
  enabled), updated locally between server fetches via the same
  per-second formula the canister uses.

## Tech stack

**Backend (on-chain Motoko)**
- `actor class DBank(initArgs : ?{ ledger : Principal })` — ledger
  canister id is configurable at deploy time; defaults to mainnet
  `ryjl3-tyaaa-aaaaa-aaaba-cai`.
- `TrieMap<Principal, Account>` with stable upgrade hooks — every user's
  balance, transaction log, and `lastSeenLedgerBalance` survive upgrades.
- All amounts in `Nat` e8s (matching the ICP ledger convention).
- `Result<T, E>` returns from `topUp` / `withdraw` / `notifyDeposit` with
  structured error variants (`#insufficientFunds`, `#rateLimited`,
  `#ledgerError`, `#ledgerUnreachable`, etc.).
- Hardening: per-principal min-interval rate limit, max-tx-amount cap,
  bounded compound time horizon, ring-buffered tx log.

**Frontend**
- React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- `@icp-sdk/core` (agent + principal) and `@icp-sdk/auth` (Internet Identity)
- `<ErrorBoundary>` at the app root, `<ConnectionBanner>` for replica
  reachability, sonner toasts for all surfaceable errors
- TanStack Query for fees / limits / transaction history
- Vitest + jsdom test suite (40+ tests covering conversions, error
  mapping, the live-balance hook, ICRC-1 textual encode/decode, CSV
  builder)
- Strict CSP via `<meta http-equiv>` — no inline scripts, no eval,
  whitelist for IC endpoints + Internet Identity origin + Google Fonts

**Design language**
- Cream/ink palette inspired by claude.ai. Source Serif 4 for display,
  Inter for body, JetBrains Mono for data. Hairline borders, generous
  whitespace, no glass blur, no signature gradients.

## Project structure

```
dbank/
├── dfx.json                                  # canister + pulled deps (II, ICP ledger)
├── docs/
│   ├── local-dev.md                          # 60-sec quickstart for the scripts
│   └── pr11-ledger-integration.md            # ledger integration spec (PR11)
├── scripts/
│   ├── local-ledger-setup.sh                 # one-shot local replica + ledger + mint
│   ├── verify-pr11.sh                        # automated PR11 verification gates
│   └── principal-to-subaccount.mjs           # principal → Candid blob helper
├── src/
│   ├── dbank-latest-backend/main.mo          # actor class DBank(initArgs)
│   └── dbank-latest-frontend/
│       ├── src/
│       │   ├── components/                   # Header, TransactionCard, DepositAddress,
│       │   │                                 # TransactionHistory, ConnectionBanner,
│       │   │                                 # ErrorBoundary, …
│       │   ├── contexts/AuthContext.tsx      # AuthClient + per-identity actor
│       │   ├── hooks/                        # useLiveBalance, useLimits
│       │   ├── lib/                          # icp.ts, icrc1.ts, csv.ts, transferErrors.ts
│       │   ├── pages/Index.tsx
│       │   └── test/setup.ts
│       ├── public/favicon.svg                # design-matching SVG icon
│       ├── scripts/rewrite-icp-imports.mjs   # rewrites @dfinity/* in dfx-generated decls
│       ├── vite.config.ts
│       └── vitest.config.ts
└── .github/workflows/ci.yml                  # frontend (typecheck + tests) + dfx build
```

## Running locally

Prerequisites: [DFX SDK](https://internetcomputer.org/docs/current/developer-docs/setup/install)
0.24+, Node.js 22+.

The fast path (recommended):

```bash
./scripts/local-ledger-setup.sh           # default: alice gets 100 ICP

# in another terminal
cd src/dbank-latest-frontend
npm install
npm start                                  # http://localhost:3000
```

The setup script restarts the local replica with `--clean`, pulls + deploys
Internet Identity and the ICP ledger via `dfx deps`, mints test ICP to a
local identity, and deploys `dbank-latest-backend` with the local ledger
canister id passed as an init argument.

To verify the ledger integration end-to-end (PR11.1 → PR11.4):

```bash
./scripts/verify-pr11.sh                   # exits non-zero on the first failed gate
```

See [docs/local-dev.md](docs/local-dev.md) for the full walkthrough,
including how to override the test user / initial mint amount.

## Tests

```bash
cd src/dbank-latest-frontend
npm test                                   # vitest run (40+ cases)
npm run typecheck                          # tsc --noEmit
```

Backend canister builds are validated by the `motoko` job in
`.github/workflows/ci.yml` on every push.

## Interest mode

The canister has a `stable var accrueInterest : Bool` defaulting to `false`.
When off (the default in custody mode), `compoundAccount` is a no-op —
internal balances are 1:1 claims on real ICP held in the ledger.

To enable the simulated interest, you'd need a funded reserve (the
canister's main account, holding enough ICP to back the implied claims).
This is not implemented; see
[`docs/pr11-ledger-integration.md` § 7](docs/pr11-ledger-integration.md#7-where-does-interest-come-from)
for the design space and the open product questions in § 14.

The frontend's `useLimits()` hook reads the flag at runtime, so the
landing page hero, the interest-rates section, and the auth-gate copy
all flip automatically based on the canister's mode.

## Notes

- `getID()` was removed in PR9 (placeholder); the public canister API is
  documented in `src/dbank-latest-backend/main.mo`.
- Internet Identity local URL convention is
  `http://<II_CANISTER_ID>.localhost:4943` for Chrome/Firefox; Safari
  needs the query-param form (handled by `dfx`).
- The `dfx generate` output still imports from `@dfinity/*` (deprecated);
  `src/dbank-latest-frontend/scripts/rewrite-icp-imports.mjs` runs as a
  prebuild step to rewrite those to `@icp-sdk/*`.

## License

MIT
