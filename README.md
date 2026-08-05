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
- **💸 Transactions** — add, edit, delete, search, and filter income & expenses.
- **🏷️ Categories & subcategories** — add and remove your own categories, and
  nest subcategories under them. Deleting a category also removes its
  subcategories. The dashboard donut rolls spending up to the top-level
  category for a clean overview.
- **🎯 Budgets by category** — set a monthly limit per category (or
  subcategory) with progress bars that turn amber near the limit and red when
  exceeded.
- **🏦 Accounts** — checking, savings, cash, and credit balances that update
  automatically from your transactions.
- **👨‍👩‍👧 Family sharing** *(cloud mode)* — invite family members with a code so
  everyone shares one budget, each with their own login. Row Level Security
  keeps every household's data private.
- **💾 Backup & restore** — export a JSON copy of all your data from **Settings**
  with one click, and import it later to restore it on this device (or add it
  into a cloud household).
- **🌗 Light & dark themes** — pick Light, Dark, or follow your device setting.
  A quick toggle lives in the sidebar (and the mobile top bar).
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
    ├── dashboard.js  transactions.js  budgets.js
    ├── accounts.js   family.js        settings.js
supabase/
└── schema.sql          # tables + RLS + create/join household RPCs
```

## How family sharing works (cloud mode)

A **household** is a shared budget space. Creating one makes you its owner and
gives you an 8-character **invite code** (shown on the **Family** page). Family
members sign up, choose **Join**, and enter the code. Everyone then sees the
same accounts, transactions, budgets, and categories across their devices, while
Postgres Row Level Security guarantees other households can't see your data.

## License

MIT — use it for your own family, or fork it and make it yours.
