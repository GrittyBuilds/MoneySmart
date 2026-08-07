# MoneySmart 💰

A simple **family budgeting web app** built with plain **HTML, CSS, and vanilla
JavaScript** — no build step, no framework, no bundler. Open it in a browser and
it just works.

It starts fully **offline using your browser's storage**, and you can optionally
**connect a free [Supabase](https://supabase.com) project** to sync across
devices and share one budget with your family.

![No build step](https://img.shields.io/badge/build-none-10b981) ![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e) ![Storage](https://img.shields.io/badge/storage-local%20%2B%20Supabase-3ecf8e)

## Features

- **📊 Dashboard** — total balance, monthly income / expenses / net, a
  spending-by-category donut, a 6-month income-vs-expense bar chart, and recent
  activity. Charts are hand-drawn SVG — no chart library.
- **💸 Transactions** — add, edit, delete, search, and filter income, expenses &
  transfers. Each has a **description** and a **vendor** line (with autocomplete
  from past vendors). Pick a category with a **type-ahead search box** — start
  typing and matching categories/subcategories filter instantly.
- **🔁 Transfers** — move money between accounts, including **paying off a credit
  card**. Transfers lower the source balance and the card's owed amount, and are
  never counted as income or expense.
- **🔂 Recurring transactions** — tick **Repeat** when adding a transaction
  (weekly, every two weeks, monthly, or yearly) or manage rules from the
  **Recurring** panel on the Transactions page. Due transactions are created
  automatically each time the app opens.
- **✂️ Split transactions** — split one transaction's amount across multiple
  categories/subcategories; the editor keeps a running total and only saves when
  the splits add up. Splits flow through the dashboard, budgets, and reports.
- **➕ Quick add** — a central **+** button in the mobile bottom bar (and the
  desktop sidebar) opens a menu to add a transaction, transfer, account,
  category, or tag from anywhere.
- **🔖 Tags** — create colored tags and attach several to any transaction, then
  filter and report on them.
- **📈 Reports & printable statements** — three report types over any date
  range: a **Breakdown** (group by category, subcategory, tag, vendor, account,
  or month), a **Profit & Loss** statement (income vs. expenses by category),
  and a **Cash Flow** statement (inflows/outflows/net by month). Every view can
  be **printed to a branded PDF** (Print / PDF button) or **exported to CSV**.
- **🔐 Auto-lock** — optionally lock the app after 1–30 minutes of inactivity
  (Settings → Security), on top of the PIN lock screen.
- **🏷️ Categories & subcategories** — ships with a thoughtful set of sample
  top-level categories, each with starter subcategories. Add and remove your
  own, and nest subcategories under them. Deleting a category also removes its
  subcategories. The dashboard donut rolls spending up to the top-level
  category for a clean overview.
- **🎯 Budgets by category** — set a monthly limit per category (or
  subcategory) with progress bars that turn amber near the limit and red when
  exceeded. **Subcategory budgets and spending roll up into their parent**, so a
  top-level category always reflects the whole group.
- **🏦 Accounts & net worth** — checking, savings, cash, credit card, and loan
  balances that update automatically from your transactions. **Credit cards and
  loans are treated as debts**: their balance is the amount owed and counts
  negatively toward your net worth, and spending on a card increases what you
  owe. **Tap an account** to open it and see all of its transactions. The
  Accounts screen stacks cleanly on mobile with no sideways scrolling.
- **👨‍👩‍👧 Family sharing** *(cloud mode)* — invite family members with a code so
  everyone shares one budget, each with their own login. Row Level Security
  keeps every household's data private.
- **💾 Backup & restore** — export a JSON copy of all your data from **Settings**
  with one click, and import it later to restore it on this device (or add it
  into a cloud household).
- **🔒 App lock** — set a device PIN to keep your budget private. A branded
  lock screen (keypad) guards the app on every open; the PIN is stored hashed
  in the browser. Manage it under **Settings → Security & app lock**, and lock
  on demand from the sidebar or top bar.
- **🌗 Light & dark themes** — pick Light, Dark, or follow your device setting.
  A quick toggle lives in the sidebar (and the mobile top bar). Styled to the
  MoneySmart brand — Grow Green on Cloud/white in light, bright green on Ink
  Navy in dark, with the Poppins + Inter type system.
- **📱 Responsive** — a mobile-first layout with a desktop sidebar and a mobile
  bottom tab bar. Add it to your home screen (it ships a web manifest).

## Two ways to store data

| Mode | Setup | Syncs across devices | Family sharing |
| --- | --- | --- | --- |
| **Local** (default) | None — just open the app | No (one device) | No |
| **Cloud** (Supabase) | Paste your project URL + key | Yes | Yes |

You can start local and connect Supabase later from **Settings**, and even
**import your existing local data** into the cloud household in one click.

## Running it

Because it's just static files, any of these work:

```bash
# 1. Open directly — double-click index.html (local mode works offline)

# 2. Or serve it with any static server:
python3 -m http.server 8000      # then open http://localhost:8000
#   npx serve .
#   php -S localhost:8000
```

> **Tip:** Cloud (Supabase) mode needs the app served over `http(s)://` so the
> Supabase library can load from its CDN. Local mode works even from `file://`.

Deploy the folder as-is to any static host — GitHub Pages, Netlify, Vercel,
Cloudflare Pages, or Supabase Storage.

## Connecting Supabase (optional, for sync + family sharing)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run the contents of
   [`supabase/schema.sql`](supabase/schema.sql). This creates all tables, Row
   Level Security policies, and the create/join-household functions.
3. In the app, go to **Settings → Storage & sync**, paste your **Project URL**
   and **anon public key** (Supabase → Project Settings → API), and click
   **Connect & sync**.
4. Sign up, then **create a household** (or **join** one with an invite code
   from a family member on their **Family** page).

> The anon key is safe to keep in the browser — Row Level Security in the schema
> ensures each household can only read and write its own data.

## Project structure

```
index.html              # loads the stylesheet + scripts (in order)
styles.css              # dark theme, responsive layout
favicon.svg             # app icon
manifest.webmanifest    # add-to-home-screen metadata
js/
├── util.js             # DOM, money & date helpers, ids
├── config.js           # persisted settings (mode, currency, Supabase keys)
├── ui.js               # modal, confirm, toast, icons, stat card, month picker
├── charts.js           # dependency-free SVG donut + bar charts
├── store.js            # active backend + cached data + calculations
├── backend-local.js    # localStorage backend
├── backend-cloud.js    # Supabase backend (SDK lazy-loaded from CDN)
├── router.js           # tiny hash router
├── app.js              # bootstrap: backend choice, auth, shell, nav
└── pages/
    ├── dashboard.js  transactions.js  budgets.js  reports.js
    ├── accounts.js   family.js        settings.js
supabase/
└── schema.sql          # tables + RLS + create/join household RPCs

# Using cloud sync? Re-run supabase/schema.sql after updating — it adds the
# tags table and the vendor / tag_ids / splits columns via idempotent migrations.
```

## How family sharing works (cloud mode)

A **household** is a shared budget space. Creating one makes you its owner and
gives you an 8-character **invite code** (shown on the **Family** page). Family
members sign up, choose **Join**, and enter the code. Everyone then sees the
same accounts, transactions, budgets, and categories across their devices, while
Postgres Row Level Security guarantees other households can't see your data.

## License

MIT — use it for your own family, or fork it and make it yours.
