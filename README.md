# FinanceOS — Personal Finance Dashboard (Full-Stack Express + React)

FinanceOS is a high-performance personal finance executive, displaying income metrics, liquid values, cash flow indices, and visual budget limits. Built using a modern full-stack architecture (Express + Vite + React 18 + Tailwind CSS), it runs with premium visual assets and live, interactive in-memory data tracking.

---

## 🚀 Optimized Full-Stack Unified Flow (Highly Recommended)

Our environment leverages Express with a integrated **Vite development middleware** in dev mode, and bundles the Node server using **esbuild** for high-efficiency container service in production.

This means you do **not** need nested clients/subfolders — both parts are handled natively from the root folder:

### 1. Developer Setup
Installs all visual packages, including `recharts` for charts, and `motion` for layout animations, then hooks up the real-time live server.
```bash
# Install root dependencies
npm install

# Start the unified dev server (binds on port 3000)
npm run dev
```

### 2. Assembly & Production Host
Compiles the static React assets to `dist/` and packs server scripts into a standalone, rapid-cold-start `dist/server.cjs` module.
```bash
# Build complete client & package backend
npm run build

# Boot standalone deployment
npm start
```

---

## 🗃️ Backend API Services & Controllers

FinanceOS implements strict REST APIs inside `server.ts` representing simulated brokerage accounts. It stores fully mutable state in-memory so any updates you trigger in the interface (such as logging a Starbucks transaction, establishing a new savings goal target, or acquiring Apple stock) immediately update aggregate stats:

### Endpoints
* `GET /api/stats` -> Returns current liquid balances (Net worth, income, etc).
* `GET /api/cashflow` -> Period data points for custom cash inflow/outflow charts.
* `GET /api/spending` -> Monthly slice metrics for the donut breakdown.
* `GET /api/transactions` -> Live bookkeeping ledger rows.
* `POST /api/transactions` -> Book a transaction and dynamically adjusts corresponding budgets.
* `GET /api/budgets` -> Active limit limits for categories.
* `POST /api/budgets` -> Create or adjust category budget thresholds.
* `GET /api/portfolio` -> Stock valuations, historical indices, and YTD performance.
* `POST /api/portfolio/buy` -> Purchase securities or cryptocurrencies.
* `GET /api/goals` -> Target savings cards with tracking progress indicators.
* `POST /api/goals/contribute` -> Fund a saving card and deduct corresponding balances.
* `GET /health` -> Health status checkpoint.

---

## 🎨 Visual Identity Layout (Dark Theme OS)
* **Canvas Backdrop**: Space Ink `#0d0d0d`
* **Card Panels**: Charcoal Slate `#161616`
* **Fine Outlines**: Deep Border `#222222`
* **Accent Gains**: Neon Green `#22c55e`
* **Accent Leaks**: Coral Red `#ef4444`

### Typography Pairing
* **Display Headings**: *Space Grotesk* (High-contrast tech-forward lines)
* **General UI Text**: *Inter* (Superb readability and kerning)
* **Aggregate Indices / Metrics**: *JetBrains Mono* (Clean numbers)
