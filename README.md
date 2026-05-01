# dbank — Decentralized Bank on the Internet Computer

A decentralized banking dapp built on the Internet Computer Protocol (ICP). It pairs a Motoko canister backend with a custom React + TypeScript frontend, demonstrating end-to-end integration between an on-chain canister and a polished, production-style UI.

## What it does

- **Deposit (top-up)** funds into an on-chain canister, with a transparent network fee deducted on entry.
- **Withdraw** funds, with a withdrawal fee deducted at exit.
- **Per-second compounding interest** that compounds to exactly 1% daily, applied automatically when the balance is queried.
- **Real-time balance queries** through the canister's query interface.

## Tech stack

**Backend (on-chain)**
- Motoko canister deployed via `dfx`
- Stable variables for persistent state across upgrades
- Public functions: `topUp`, `withdraw`, `checkBalance`, `compound`, `getID`

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Router for multi-page navigation
- Custom hooks (`useInterestRate`) for reactive interest calculations
- Dark mode via theme toggle
- Glass-morphism cards with ICP-branded gradient styling

## Project structure

```
src/
├── dbank-latest-backend/
│   └── main.mo                 # Motoko canister (actor DBank)
└── dbank-latest-frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Index.tsx       # Marketing landing page
    │   │   ├── Dbank.tsx       # Banking interface (top-up / withdraw tabs)
    │   │   └── NotFound.tsx
    │   ├── components/         # Hero, Features, TrustSection, ThemeToggle, etc.
    │   ├── hooks/useInterestRate.ts
    │   └── lib/utils.ts
    ├── tailwind.config.ts
    └── vite.config.ts
```

## Running locally

Prerequisites: [DFX SDK](https://internetcomputer.org/docs/current/developer-docs/setup/install) and Node.js 18+.

```bash
# 1. Start the local ICP replica
dfx start --background

# 2. Deploy the canister and generate the Candid interface
dfx deploy

# 3. Start the frontend dev server
npm install
npm start
```

The frontend will run at `http://localhost:8080` and proxy canister calls to the local replica at `http://localhost:4943`.

To regenerate the Candid interface after backend changes:

```bash
npm run generate
```

## Notes

- Canister state uses `stable` variables so balances and timing survive canister upgrades.
- The interest formula `(1.01 ^ (1/86400))` per second yields exactly 1% compounded daily.
- This project is an exploration of ICP frontend integration; the canister logic is intentionally simple to keep focus on the React ↔ Motoko interface.

## License

MIT
