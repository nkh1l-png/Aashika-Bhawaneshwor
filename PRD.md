# Product Requirements Document (PRD)
## Aashika-Bhaweneshwor Stock Manager ("StockFlow")

**Document version:** 1.1
**Date:** 2026-06-24 (updated 2026-11-24 — editable product catalog v1)
**Status:** Reflects the current implemented build (as-built PRD)

---

## 1. Overview

### 1.1 What it is
**StockFlow** is a web-based warehouse stock-management and dispatch-tracking system built for **Aashika-Bhaweneshwor**, a beverage distribution business (beer, whisky, energy drinks, soft drinks, etc.). It runs as a small self-hosted web application that staff and administrators open in a browser.

### 1.2 The problem it solves
A beverage distributor constantly moves cases and loose pieces of stock in and out of a warehouse:
- Stock arrives from suppliers (**restock**).
- Stock goes out to shops/customers (**dispatch**).
- Stock is taken to a market and partly comes back (**daily retailing**).
- Damaged goods returned by parties must be replaced from fresh stock (**leakage/breakage**).

Doing this in a paper register or spreadsheet is error-prone, hard to audit, and gives no live picture of "what do we have right now" or "who did what." StockFlow centralizes all of this into one live inventory with a full activity history.

### 1.3 Core value
- **Single source of truth** for current stock (in cases + loose pieces).
- **Every movement is logged** with timestamp and the user who did it.
- **Role-based access** (Admin vs Staff) with an admin oversight panel.
- **Zero external dependencies for daily use** — runs locally, data stored in one file.

---

## 2. Target Users & Roles

| Role | Who | What they can do |
|------|-----|------------------|
| **Admin** | Owner / manager (e.g. `admin`) | Everything Staff can do **plus** the Admin Panel: manage users (add/remove/change password), view all-user activity log, export all data, reset all data. |
| **Staff** | Warehouse / sales employees (e.g. Aashika, Bhaweheshwor, Nishan) | Log in; view dashboard & inventory; record dispatch, restock, retailing (take out / return), and leakage/breakage; view history; export data. **Cannot** see the Admin Panel. |

Seeded default accounts (defined in `server.js`):

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| aashika | aashika123 | Staff |
| bhaweheshwor | bhaweheshwor123 | Staff |
| nishan | nishan123 | Staff |

> ⚠️ These are default credentials and should be changed before real use.

---

## 3. Architecture

### 3.1 High-level
StockFlow is a **vanilla-stack, server-rendered-free single-page app** with a thin Node.js backend. No frameworks, no build step, no external database.

```
┌─────────────────────────────────────────────┐
│  Browser (client)                            │
│  ┌─────────────┐  ┌──────────────┐           │
│  │ index.html  │  │  style.css   │           │
│  └─────────────┘  └──────────────┘           │
│  ┌─────────────┐  ┌──────────────┐           │
│  │  data.js    │  │   app.js     │  ← all UI │
│  │ (catalog)   │  │ (logic/state)│   + logic │
│  └─────────────┘  └──────────────┘           │
│        │  fetch() JSON over HTTP  ▲          │
└────────┼──────────────────────────┼──────────┘
         ▼                          │
┌─────────────────────────────────────────────┐
│  Node.js server (server.js)                  │
│  • Static file server (html/css/js/images)   │
│  • REST-ish JSON API (/api/*)                │
│  • Reads/writes a single JSON file           │
└────────────────────┬─────────────────────────┘
                     ▼
              ┌──────────────┐
              │   db.json    │  ← users + stock + ledger
              └──────────────┘
```

### 3.2 Technology used
| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend markup | **HTML5** (`index.html`) | Single page; all views are `<section>`s toggled via CSS classes. |
| Styling | **Plain CSS** (`style.css`) | Custom dark "glassmorphism" theme using CSS variables; responsive with a mobile sidebar/hamburger. |
| Frontend logic | **Vanilla JavaScript (ES6+)** (`app.js`) | One IIFE module; no framework, no bundler. ~1900 lines. |
| Product data | **Static JS array** (`data.js`) | `PRODUCT_CATALOG`, auto-generated from an Excel sheet. In v1 (2026-11-24) products can also be added, edited and deleted in the app by an admin — see §4.1 and §5.3. `data.js` remains the catalog store in v1; it is not yet in the database. |
| Backend | **Node.js core `http` module** (`server.js`) | No Express/framework — raw HTTP server. |
| Persistence | **Single JSON file** (`db.json`) | Holds users + full app state. Created automatically on first run. |
| Data generation | **`xlsx` npm package** (`generate_data.js`) | Dev-time script to regenerate `data.js` from the stock Excel file. The **only** npm dependency. |
| Fonts | Google Fonts (Inter) | Loaded via CDN. |

### 3.3 File structure
```
Aashika-Bhaweheshwor/
├── server.js          # Node HTTP server: static serving + API + db.json I/O
├── app.js             # All client logic: state, auth, rendering, events
├── data.js            # PRODUCT_CATALOG (generated from Excel)
├── generate_data.js   # Dev script: Excel → data.js (uses xlsx)
├── index.html         # Single-page UI (all views + login + modals)
├── style.css          # Theme & layout
├── package.json       # Metadata + xlsx dependency
├── db.json            # Runtime database (gitignored, auto-created)
├── images/            # Uploaded product photos, server-generated filenames (v1, 2026-11-24)
├── *.png / *.jpg      # Product images (one per product, originals in the repo root)
└── Aashika_..._Stock Book.xlsx  # Source spreadsheet for the catalog
```

### 3.4 Data flow
1. On load, `app.js` checks `sessionStorage` for a logged-in user.
2. Login POSTs to `/api/login`; on success the user object is cached in `sessionStorage`.
3. App state (stock + transactions) is fetched from `/api/state`; if the server is unreachable, it falls back to `localStorage`.
4. Every action (dispatch/restock/etc.) updates the in-memory `state`, then calls `saveState()` which **POSTs the entire state** back to `/api/state` (and mirrors to `localStorage` as backup).
5. The server writes the whole object to `db.json`.

---

## 4. Data Models

### 4.1 Product (from `data.js`, editable in the app since v1, 2026-11-24)
```js
{
  id: "prod_1",
  name: "Red Bull",
  volume: "250ml",
  piecesPerCase: 24,
  image: "Redbull 250ml.png",
  initialStockCases: 8,
  initialStockPieces: 13
}
```
The catalog still lives in `data.js` (it is not yet in the database — that move is Phase 2, see §9). Products **are now editable through the UI**, admin only:
- **Add** a product: name, volume, pieces per case, initial stock, and an optional photo.
- **Edit** a product: name, volume, pieces per case, and photo (Keep current / Change / Remove). The product `id` is never edited — it is the link used by every transaction for that product.
- **Delete** a product: admin only, and only when its stock is 0 (see §8, item 10).
- **Initial stock is read-only after creation.** `initialStockCases` / `initialStockPieces` are set when a product is added and never edited afterwards. Stock changes only through restock / dispatch / retailing, never by editing the product — that keeps the ledger honest.
- **Photo:** when a photo is uploaded, the server gives it a server-generated filename in `images/` (png/jpg/jpeg/webp only, 3 MB server-side cap, file contents checked, not just the extension). The old file is deleted only after the new one is saved, and only if no other product uses it — several products share one image file today. If no photo is set, the product shows the plain icon.
- A product with the same name + volume as another product cannot be added or edited in (duplicate → 409). Name/volume lengths are capped and `<`, `>` and quotes are rejected.
- The catalog is still regenerated from the Excel file by `generate_data.js` / the Excel import — see the warning in §8, item 13: importing can overwrite manual add/edit/delete work.

### 4.2 Stock (per product, in `state.stock`)
```js
state.stock["prod_1"] = { cases: 8, pieces: 13 }
```
Total pieces = `cases × piecesPerCase + pieces`. The app always re-normalizes loose pieces back into full cases after each operation.

### 4.3 Transaction / "dispatch" record (in `state.dispatches[]`)
Every movement — of any type — is stored in one array as an append-only ledger:
```js
{
  id: "txn_1718800000000_ab12cd",
  productId: "prod_1",
  cases: 2,
  pieces: 0,
  totalPieces: 48,
  notes: "Delivered to XYZ shop",
  timestamp: "2026-06-24T10:15:00.000Z",  // ISO / UTC
  type: "dispatch",                        // see types below
  user: "aashika"
}
```

**Transaction types:**
| Type | Effect on stock | Meaning |
|------|-----------------|---------|
| `dispatch` | − deduct | Sent out to a customer/shop |
| `restock` | + add | Received from supplier |
| `retail-takeout` | − deduct | Taken to market for the day |
| `retail-return` | + add | Unsold goods returned to inventory |
| `leakage` | − deduct | Damaged (leaked) goods replaced from fresh stock |
| `breakage` | − deduct | Damaged (broken) goods replaced from fresh stock |

### 4.4 User (in `db.json` → `users[]`)
```js
{ username: "admin", password: "admin123", role: "admin", displayName: "Admin" }
```

### 4.5 db.json shape
```js
{
  "users": [ ...user objects... ],
  "stock": { "prod_1": { "cases": 8, "pieces": 13 }, ... },
  "dispatches": [ ...transaction objects... ],
  "initialized": true
}
```

---

## 5. Functional Requirements (Features by View)

### 5.1 Login
- Username + password form; calls `/api/login`.
- On success, session is stored and the app loads.
- Session persists for the browser tab (`sessionStorage`) — closing the tab logs out.

### 5.2 Dashboard
- **Stat cards:** Total Products, Total Cases, Today's Dispatches, Low-Stock Alerts, Leakage/Breakage today (animated counters).
- **Product overview grid:** every product as a card with image, current stock, and a colored status badge (In Stock / Low Stock / Out of Stock).
- Filters by **brand** and **status**; global search box (searches name + volume).
- Clicking a card opens a **product detail modal** with stock breakdown, quick Dispatch/Restock buttons, and that product's last 5 transactions. For an admin, the modal also has an **Edit** button (see §5.3). Staff see no Edit button.

### 5.3 Inventory
- Full table: product, volume, pieces/case, cases, loose pieces, total pieces, status, and quick **Dispatch / Restock** action buttons per row.
- Sortable (name A–Z/Z–A, stock low→high/high→low) and brand-filterable.
- **Edit / Delete products (admin only, since v1, 2026-11-24):** each Inventory row has **Edit** and **Delete** buttons, visible only to an admin. Staff see no Edit/Delete buttons at all.
- **One shared Add/Edit form:** Add opens the same form blank; Edit opens it pre-filled with that product's current name, volume, pieces per case and photo. Only 4 fields: product name, size (free text, e.g. `650ml`), pieces in 1 case, and photo — a big preview, default **Keep current photo**, with **Change photo** (pick from camera/gallery) and **Remove photo** (falls back to the plain icon). Starting stock appears on Add only; it is not shown on Edit (see §4.1).
- **Saving:** the form checks name + size are filled and that no *other* product already has that name + size. On save the app shows a toast ("Product saved") and reloads the page, so every dropdown (Dispatch / Restock / Retailing / Leakage) shows the new name and no deleted product.
- **Deleting:** two taps, never one. The confirmation states the facts in plain words — the product name, its stock, and how many past records it has — and says past records will stay but will show as "Deleted Product", and that this cannot be undone. Delete is refused by the server when stock is above 0 ("clear the stock first — dispatch it or move it"). See §8, item 10.

### 5.4 Dispatch
- Form: choose product → live stock preview → enter cases/pieces + optional note → submit.
- Validates quantity > 0 and **not more than available**; deducts stock and logs a `dispatch` transaction.
- Right panel shows **today's dispatches** with a running total (items + product count).

### 5.5 Restock
- Same pattern, but **adds** stock and logs a `restock` transaction.
- Shows the 20 most recent restocks.

### 5.6 Daily Retailing (3-step workflow)
1. **Take Out** — deduct stock to take to market (`retail-takeout`).
2. **Return Unsold** — add returned goods back (`retail-return`).
3. **Daily Summary** — for a chosen date: total Taken, Returned, and **Sold (= taken − returned)**, plus a product-wise breakdown with sold/returned bars, and a recent-transactions list.

### 5.7 Leakage / Breakage
- Record damaged goods returned by a named **party**, choosing type (leakage/breakage).
- Deducts fresh replacement stock and logs the transaction with the party name baked into the note.
- Shows recent records and all-time leakage/breakage totals.

### 5.8 History
- Full transaction timeline, **grouped by date**, newest first.
- Filter by **date** and **product**; clear-filters button.
- Color-coded icons and +/− quantities per transaction type, with the acting user shown.

### 5.9 Admin Panel (Admin only)
- **Stats:** total users, total transactions, today's transactions.
- **User Activity grid:** per-user change counts.
- **User Management:** add user, remove user (cannot remove yourself or the last admin), change any user's password.
- **Activity Log:** all transactions filterable by user / type / date (up to 100 shown).
- **System Actions:** Export All Data (JSON), Reset All Data (restores initial stock & clears history — irreversible, confirmation required).

### 5.10 Cross-cutting
- **Export Data** (sidebar) — downloads a JSON snapshot of catalog + current stock + all transactions.
- **Toast notifications** for every action outcome.
- **Confirmation dialogs** for destructive actions.
- **Responsive** layout with collapsible sidebar for mobile.

---

## 6. API Reference (server.js)

| Method | Path | Purpose | Auth enforced on server? |
|--------|------|---------|--------------------------|
| POST | `/api/login` | Validate credentials, return user (no password) | n/a |
| GET | `/api/users` | List users (without passwords) | ❌ No |
| POST | `/api/users/add` | Add a user | ❌ No |
| POST | `/api/users/remove` | Remove a user (protects last admin) | ❌ No |
| POST | `/api/users/change-password` | Change a user's password (min 4 chars) | ❌ No |
| GET | `/api/state` | Get stock + transactions (users stripped out) | ❌ No |
| POST | `/api/state` | Overwrite stock + transactions (users preserved) | ❌ No |
| POST | `/api/admin/add-product` | Add a product (admin only) | ✅ Admin only, server-enforced |
| POST | `/api/admin/edit-product` | Edit a product's name, volume, pieces per case and/or photo (admin only) | ✅ Admin only, server-enforced |
| POST | `/api/admin/delete-product` | Delete a product (admin only; refused when stock > 0) | ✅ Admin only, server-enforced |
| (any) | `/*` | Serve static files (html/css/js/images) | n/a |

> ⚠️ **Important:** role checks exist only in the browser. The server does **not** verify identity or role on any endpoint. See §8.

> **Note on the table above (2026-11-24):** the three catalog endpoints (`add-product`, `edit-product`, `delete-product`) are the exception — they **are** admin-only on the server (a staff token gets 403), run inside the server lock (`withLock`), and are written to the audit log with before → after values. The older rows in this table have not been re-audited as part of this change and are left as they were.

**Catalog endpoints (v1, 2026-11-24):**
- `POST /api/admin/edit-product` — admin only. Fields: product id, name, volume, `piecesPerCase`, optional photo (base64; omitting it keeps the current photo). Duplicate name + volume (excluding the product itself) → 409. Changing `piecesPerCase` while the product has stock → refused (see §8, item 11). Returns the updated product.
- `POST /api/admin/delete-product` — admin only. Deletes the product from the catalog and removes its stock entry; the transaction history is left untouched, so old rows render as "Deleted Product". Refused when stock is above 0, with the stock and transaction counts in the error. Audited as `product-removed`.
- `POST /api/admin/add-product` — admin only, as before, but now uses the same image handling as edit: server-generated filename in `images/`, magic-byte + size checks (png/jpg/jpeg/webp, 3 MB server-side cap), never a user-supplied filename. The old image path (extension-only check, filename from name + volume, saved in the repo root) is no longer used.
- All three endpoints back up `data.js` (timestamped copy, last 10 kept) and write it atomically (temporary file + rename) inside the server lock, so a crash mid-write cannot corrupt the whole catalog.

---

## 7. Non-Functional Requirements

- **Deployment:** single Node process, no build step. `npm install` then `node server.js` on port **3000**.
- **Persistence:** one `db.json` file on local disk; requires a host with a persistent filesystem (not serverless/ephemeral).
- **Performance:** in-memory state, instant client rendering; suitable for one warehouse / small team. The full ledger is loaded into memory and re-saved in full each write.
- **Browser support:** modern evergreen browsers (uses `fetch`, ES6, CSS variables).
- **Offline behavior:** if the server is unreachable, the client falls back to `localStorage` (per-device, not synced).
- **Footprint:** ~1 npm dependency (`xlsx`, dev-only); tiny disk/RAM needs.

---

## 8. Known Limitations & Risks (as-built)

These are documented honestly so future work can address them. (See the separate code-review for detail.)

1. **No server-side authentication/authorization** — all `/api/*` endpoints are open; anyone who can reach the server can read users, create an admin, change passwords, or overwrite all stock data. Safe on a private LAN; unsafe on the public internet without fixes.
2. **Whole-state overwrite → concurrent edits clobber each other** — two users acting at once can overwrite each other's transactions (data loss risk).
3. **Timezone mismatch** — timestamps are stored in UTC but "today" is computed in local time, so daily counts/filters are wrong for part of each day (notably in Nepal, UTC+5:45).
4. **Stored XSS** — free-text fields (notes, party, names) are inserted via `innerHTML` without escaping.
5. **Plaintext passwords** — stored in `db.json` and sent over plain HTTP.
6. **Negative-quantity validation gap** — a negative value in restock/return can subtract stock.
7. **No edit/undo of a transaction** — only full reset, which erases everything.
8. **No backups** — single file; corruption or accidental reset loses all data.
9. **Low-stock logic** uses only `cases < 3`, ignoring loose pieces.
10. **Delete rule (catalog v1, 2026-11-24)** — a product can only be deleted when its stock is 0. If stock is above 0 the server refuses the delete. Deleting is a real (hard) delete: the product disappears from the Dashboard, Inventory and every product dropdown. Its past transactions are **not** deleted — they stay in History and render as "Deleted Product" (the name is lost in old rows, the quantities are not: each transaction stores its own cases / pieces / total pieces). There is no undo-delete and no archive/restore in v1 (Phase 2, see §9).
11. **Pieces-per-case rule (catalog v1, 2026-11-24)** — `piecesPerCase` cannot be changed while the product has stock. Changing it with stock on hand would silently change what the stored cases mean in total pieces. Clear the stock first, then change it. Renormalising stock from total pieces instead of blocking is a Phase 2 idea, not v1.
12. **Catalog / photo edits do not survive a free Render redeploy (catalog v1, 2026-11-24)** — catalog edits live in `data.js` and uploaded photos live in `images/`, both on the server disk. On free Render the disk is wiped on redeploy/restart, so those edits are lost unless they are committed to GitHub afterwards. Data in MongoDB Atlas (stock, transactions, users) survives; the catalog and photos do not yet. Moving the catalog into the database is Phase 2 (see §9 and DEPLOY.md, "Catalog edits and Render").
13. **Excel import can overwrite manual catalog work (catalog v1, 2026-11-24)** — `/api/admin/import-catalog` regenerates the whole catalog from the Excel file (`prod_1…N`, in sheet order) and rewrites `data.js`. Products added, edited or deleted by hand in the app can be lost by an import. The admin is warned and asked to confirm before an import runs. Rewiring the import to merge (upsert, never delete) is Phase 2, not v1.

---

## 9. Future Enhancements (Roadmap ideas)

### Done in v1 (2026-11-24)
- **Editable product catalog from the UI** — admin can add, edit (name, volume, pieces per case, photo) and delete (stock must be 0) products in the app, instead of only regenerating from Excel. See §4.1, §5.3 and §6.

### Phase 2 — catalog follow-ons (not done in v1)
- **DB-backed catalog** — move the catalog into the database (`db.products`, seeded once from `data.js`), so catalog edits survive a Render redeploy like stock data does. `data.js` becomes a frozen seed only.
- **Archive / restore** — hide a product from all lists without deleting it, with a restore option, so its name still shows in old history rows.
- **Pieces-per-case renormalisation** — allow changing pieces per case with stock on hand by recomputing cases/loose pieces from total pieces, with a warning and audit entry, instead of blocking.
- **Excel import as upsert** — importing a catalog merges by name + volume (update / add, never delete) and shows a change summary for the admin to confirm first, instead of regenerating the whole catalog.

### Other future ideas
- Real server-side auth with session tokens + hashed passwords + HTTPS.
- Append-only transaction API (per-transaction endpoints) to fix concurrency.
- Edit/correct/undo individual transactions.
- Automatic daily backups of `db.json`.
- Pricing per product → revenue/sales reporting; monthly summaries.
- Export to Excel/PDF for accounting.
- Low-stock reorder report (single screen of everything to restock).
- "Remember me" persistent login; per-user self-service password change.

---

## 10. Setup & Run (quick reference)

```bash
# 1. Install the one dependency
npm install

# 2. Start the server
node server.js

# 3. Open in a browser
http://localhost:3000

# Log in with a default account (e.g. admin / admin123)
```

To regenerate the product catalog after editing the Excel file:
```bash
node generate_data.js   # rewrites data.js from the .xlsx
```

---

*End of document.*
