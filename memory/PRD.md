# LedgerSync — Product Requirements Document

## Original Problem Statement
Build "LedgerSync" — a stablecoin-native (USDC on Base) billing + ERP integration OS for micro-SaaS founders. Bridges Web3 micro-transactions (USDC on Base) and traditional Web2 accounting: founders generate checkout links, accept sub-cent gas USDC payments, and auto-reconcile onchain events into Web2 invoices (QuickBooks/Xero).

## Stack (as delivered)
Requested stack was Next.js/Postgres/Prisma/viem. Delivered on the platform-native stack with identical functionality and data models:
- **Frontend:** React 19 (CRA + CRACO), React Router, Tailwind, shadcn/ui, Recharts, lucide-react
- **Backend:** FastAPI (Python)
- **DB:** MongoDB (motor)
- **Web3:** Real Base **mainnet** reads via public JSON-RPC (`eth_getTransactionReceipt`, `eth_getLogs`); checkout pays via injected EIP-1193 wallet (ERC20 `transfer` calldata)
- **Auth:** JWT email/password (httpOnly cookies) + Emergent Google OAuth
- **ERP:** QuickBooks/Xero interfaces MOCKED (payloads generated + logged)

## User Choices
- Real Base mainnet onchain layer · JWT + Google auth · Mocked ERP · "you design" (Swiss high-contrast dark obsidian + Base blue theme)

## Personas
- **Founder (primary):** micro-SaaS operator accepting USDC, needs clean books.
- **Customer (payer):** connects a Base wallet on a public checkout page to pay an invoice.

## Core Requirements (static)
1. Checkout Engine — public `/pay/:nonce` page, connect Base wallet, pay USDC, onchain verify.
2. Onchain Listener — background worker polling Base mainnet for USDC transfers to founder wallets, matching pending invoices.
3. ERP Sync Engine — on PAID, format + push reconciled invoice to QuickBooks/Xero (mocked), with logs + payload inspector + retry.
4. Founder Dashboard — MRR/ARR, active subs, payment history, ERP sync logs, checkout link generator.

## Implemented (2026-06)
- JWT auth (register/login/logout/me/refresh) + full password reset (email via Emergent key) + brute-force lockout; Emergent Google OAuth session flow. [race-condition on post-login redirect fixed]
- Founder settings (company, Base settlement wallet, ERP provider/key).
- Customers / Products / Subscriptions CRUD (founder-scoped).
- Invoices: create (unique `ls_` payment nonce), list, search/filter, copy checkout link.
- Public checkout page with wallet connect + USDC pay + BaseScan links + onchain confirm endpoint (txHash regex + receipt verification).
- Onchain Listener background task (polls Base mainnet every ~25s) + live status page (block height, events).
- ERP Sync engine (mocked) + logs table + JSON payload inspector + retry.
- Dashboard stats (MRR/ARR, active subs, collected USDC, synced count, 6-month revenue trend) + recent payments.
- Seeded demo data for founder nexai.coach@gmail.com.
- Distinctive dark-obsidian + Base-blue UI, Plus Jakarta Sans / Inter / JetBrains Mono.
- Backend verified: 18/18 pytest passing; frontend smoke flows 100%.

## Backlog (prioritized)
- **P1:** Status-only PATCH for subscriptions; recurring auto-invoicing from subscriptions (cron) on nextBillingDate.
- **P1:** Real ERP OAuth (QuickBooks/Xero) to replace mocks.
- **P2:** WebSocket live event pulse on listener; per-invoice nonce-memo matching via a smart-contract router.
- **P2:** Split server.py into routers/ (auth, invoices, listener, erp); add DialogDescription for a11y.
- **P2:** Multi-currency, refunds, CSV export of payment history.

## Test Credentials
nexai.coach@gmail.com / LedgerSync2026! (see /app/memory/test_credentials.md)
