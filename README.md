# MoneySmart 💰

A simple, responsive **family budgeting app** that syncs across every device via
[Supabase](https://supabase.com). Installable as a PWA on both phones and
desktops — one codebase, works everywhere.

![Stack](https://img.shields.io/badge/React-18-149eca) ![Vite](https://img.shields.io/badge/Vite-5-646cff) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e) ![PWA](https://img.shields.io/badge/PWA-installable-10b981)

## Features

- **📊 Dashboard** — total balance, monthly income/expenses/net, spending-by-category
  donut, a 6-month income-vs-expense trend, and recent activity.
- **💸 Transactions** — add, edit, delete, search, and filter income & expenses.
- **🎯 Budgets by category** — set a monthly limit per category and watch progress
  bars turn amber then red as you approach and exceed them.
- **🏦 Accounts** — track checking, savings, cash, and credit balances that update
  automatically from your transactions.
- **👨‍👩‍👧 Family sharing** — invite family members with a code so everyone shares one
  budget, each with their own login. Row Level Security keeps every household's
  data private.
- **📱 Responsive + installable** — a mobile-first layout with a desktop sidebar,
  plus offline-ready PWA support so you can install it to your home screen or
  desktop.

## Tech stack

| Layer     | Choice                                            |
| --------- | ------------------------------------------------- |
| UI        | React 18 + TypeScript + Vite                      |
| Styling   | Tailwind CSS                                      |
| Charts    | Recharts                                          |
| Icons     | lucide-react                                      |
| Backend   | Supabase (Postgres, Auth, Row Level Security)     |
| Packaging | vite-plugin-pwa (installable, offline-capable)    |

## Getting started

### 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project (the
   free tier is plenty for a family).
2. Open the **SQL Editor**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates
   all tables, Row Level Security policies, and the helper functions used for
   creating and joining households.

### 2. Configure the app

```bash
cp .env.example .env
```

Fill in the two values from **Supabase → Project Settings → API**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

> The anon/public key is safe to ship in a client app — Row Level Security in
> the schema ensures each household can only read and write its own data.

### 3. Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Sign up, then **create a household** (or **join** one
with an invite code from a family member).

### Build for production

```bash
npm run build      # type-checks and builds to dist/
npm run preview    # serve the production build locally
```

The output in `dist/` is a static PWA you can host anywhere (Netlify, Vercel,
Cloudflare Pages, GitHub Pages, or Supabase Hosting).

## Using it as an app

- **Mobile** (iOS/Android): open the site in the browser and choose
  **Add to Home Screen**.
- **Desktop** (Chrome/Edge): click the **install** icon in the address bar to run
  MoneySmart in its own window.

Want a true native desktop binary later? The same web build drops straight into
[Tauri](https://tauri.app/) or Electron with no code changes.

## How family sharing works

A **household** is a shared budget space. When you create one you become its
owner and get an 8-character **invite code** (shown on the **Family** page).
Family members sign up, choose **Join**, and enter that code. Everyone then sees
the same accounts, transactions, budgets, and categories in real time across
their devices, while Postgres Row Level Security guarantees other households
can't see your data.

## Project structure

```
src/
├── components/     # Layout (responsive nav), Modal, MonthPicker, UI kit
├── context/        # AuthContext, HouseholdContext (current household + members)
├── hooks/          # useAccounts, useTransactions, useBudgets
├── lib/            # supabase client, types, money/date formatting, computations
└── pages/          # Login, Onboarding, Dashboard, Transactions, Budgets,
                    #   Accounts, Family, SetupNeeded
supabase/
└── schema.sql      # tables + RLS policies + create/join household RPCs
```

## License

MIT — use it for your own family, or fork it and make it yours.
