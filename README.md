# Finance HQ v0.3.9

A free, mobile-first, read-only personal finance PWA, continued from the original v0.2 package. Static HTML, CSS and JavaScript; no server, paid service, bank API, or AI scanner.

## Features

- Overview, transaction search, linked receipt gallery, budgets and savings, credit-card dues/reconciliation, bills/installments, shared balances, rebates and reports.
- **Transaction sorting:** click Date, Transaction, Swipe, My Share, or Other Bill Portion to toggle ascending/descending. A dropdown adds category, payment method, and split issues first. The selected sort persists while searching and switching cutoff and never edits or reorders the master Sheet.
- **Typography fix:** freeze-column Date is wider and non-breaking, so `Unconfirmed` and ISO dates never split midword. Long transaction names wrap only at natural word boundaries when possible.
- **Spending limit terminology:** Fixed Weekly Spend Limit is **after savings**. Base Weekly Allowance is **before savings**, and Safe Spending Left is **after savings, carryover, actual spending, and verified credits**.
- **Frozen Transactions table columns:** on wide desktop views, Date and Transaction stay pinned at the left while Receipt / Source stays pinned at the right as the center numeric columns scroll. On small phones/tablets, freeze only Transaction (with its date repeated in the description) so numeric fields remain reachable. Transaction table is keyboard-focusable for horizontal scrolling; no changes to other tables.
- **Transaction split reconciliation:** for comparable positive actual/swiped purchases with a verified My Share value, display the **other portion of the full bill** as actual swipe minus My Share. Show the original Sheet H value separately whenever it is partial, with the additional balance highlighted. Do not imply the derived bill portion is an unpaid/collectible receivable. Flag net settlements/offsets, rebates, planned charges, and unallocated source rows without inventing party allocations.
- Source-authoritative 16th–15th cutoffs with the July 2026 historical exception. Start-year workbook routing handles December–January. Both tracker layouts are supported.
- Fixed weekly limits and current remaining spending are separate; actual purchases, estimates, reserves, personal shares, reimbursements and issuer payments stay distinct.
- Google Identity Services authorization with only `spreadsheets.readonly`; Sheets requests are GET only. Live financial records remain in memory. The short-lived access token is held in tab-scoped `sessionStorage` to resume after reload; it is never written to `localStorage`, snapshots, caches, or GitHub.
- Five-minute visible-tab refresh, manual refresh, manual lock and five-minute idle lock.
- Optional encrypted offline snapshot for one cutoff per browser. AES-256-GCM with a random salt/IV and PBKDF2-SHA256 (310,000 iterations). Passphrase and encryption keys are never saved. A snapshot is explicitly labeled with its refresh time. Disconnect deletes the saved snapshot.
- Offline app shell, app-scoped service worker/manifest, iPhone Add to Home Screen and responsive navigation.
- **Receipt Gallery hover previews:** on desktop, hovering a receipt card or the View receipt control for 350ms opens a private Google Drive preview **inside Finance HQ** without clicking. Tap/click opens the existing full-size dialog. Finance HQ does not make receipts public, copy them, request the Drive API scope or store their contents. If the private embed is blocked (notably in some Safari/iPhone configurations), the dialog has an optional **Open original only if needed** fallback. Non-file Google links display an in-app notice instead.
- Explicitly separate synthetic demo. Keep receipt analysis and expense logging in ChatGPT; this app never writes to Sheets.

## Account setup (required before live use)

1. In your own Google Cloud project, enable Google Sheets API and configure Google Auth Platform. Add your account as a test user if required. No billing account or paid API is needed for this app.
2. Create an OAuth **Web application** client and authorize the JavaScript origin `https://shaunlittmanco.github.io` (no path). Local testing requires its exact localhost origin separately.
3. Open Finance HQ → Settings. Enter the public OAuth client ID and the two original tracker links. These connection settings are stored only in your browser. Never enter or commit a client secret.
4. Click **Connect Google & refresh** and approve read-only access. Google controls account authorization; the read-only Sheets scope can read spreadsheets accessible to the selected account, while the app requests only the selected trackers.
5. On iPhone, open the HTTPS app in Safari → Share → Add to Home Screen. Reload in the same tab resumes a valid session and fetches fresh figures without another Google popup. Reconnect after Google token expiry, manual lock/disconnect or five minutes without activity. Offline data requires a previously saved encrypted snapshot and its passphrase.

A ChatGPT Google Drive connection does not authorize this separate browser app. Google Cloud account verification and the app's OAuth consent must be completed by the account owner.

## Development

```sh
npm run check
npm test
npm run build
```

No dependency install is needed. `build` creates an allowlisted `dist/` containing only the public shell. For GitHub Pages, publish `main` / root; `.nojekyll` disables Jekyll. Tests and fixtures contain invented examples only. Never add exports, receipts, real-data fixtures, tokens, credentials, passphrases, or private snapshots to this repository.

## Validation and release status

- 52 automated tests cover parsing, workbook routing, OAuth browser scope, canceled authorization, receipt URLs, source header/formula errors, encryption, tampering, XSS escaping and offline shell cache behavior.
- Private read-only source validation covered all 18 available cutoffs across the two workbooks, with 2,763 numeric comparisons. Source data and the private validation inputs are deliberately excluded from this repository.
- Browser checks covered all eight sections plus settings at desktop size, and 390/430 px iPhone-sized layouts, transaction navigation and connection settings.
- Live Google OAuth authorization and all eight sections were verified against both configured workbooks. Encrypted snapshot save, wrong-passphrase rejection, manual lock, reload and successful unlock were verified in the deployed browser. The temporary QA snapshot was deleted afterward.
- Real-device Safari/Add to Home Screen and a physical device airplane-mode roundtrip remain pending. Browser layout checks do not substitute for native Safari testing.
- v0.3.1 fixes apostrophe rendering in live merchant names; no financial calculation changed.

See [SECURITY.md](SECURITY.md) for the deployment boundary and remaining risks.

- v0.3.3 versions app script/style URLs to prevent mixed cached assets during updates.

- v0.3.3 distinguished saved-but-disconnected sessions from first-time setup. Reload/lock shows a direct Connect Google button, the top action reconnects, and pending sync shows loading. Google decides whether previously granted access needs another consent screen; that release still held tokens in memory only.

- v0.3.4 resumes valid Google authorization across same-tab reloads and automatically performs fresh read-only sync. Tests cover unchanged expiry, retained idle deadline, malformed sessions, tracker/client binding, blocked storage, 401 invalidation and lock/disconnect cleanup. Google access is capped at one hour or its shorter issued lifetime; no refresh token or automatic reauthorization is added. Browser session restoration can preserve tab storage, but expiry and idle validation still apply.

## In-app receipt viewer (v0.3.5)

Open **Transactions → Receipt gallery** and select **View receipt**. You can also preview receipts from transaction rows or the Overview. The viewer stays inside the Finance HQ screen with a close button; it embeds the existing restricted Google Drive file using `/file/d/ID/preview` with no additional Google API scope. Google still controls who is allowed to view the file. No private receipt bytes or URLs are bundled into the public source. On some browsers (especially Safari with cross-site tracking restrictions), embedded private previews can fail. In that case, you can optionally open the original Google link using the viewer's fallback. Do **not** change file sharing to "Anyone with the link" just to make embedding work.

## Desktop hover preview (v0.3.6)

In Transactions → Receipt gallery, hover any linked receipt card for a quick preview. Hovering the View receipt control in transaction rows or Overview works too. The preview waits 350 ms to avoid accidental loading and automatically closes after pointer exit (260 ms grace), scrolling, locking, or switching account/cutoff. Use **Expand** for the full-size viewer. On touch-only devices like an iPhone, tap **View receipt** instead; hover is intentionally disabled. The existing private Google permissions apply. Safari or privacy extensions may block the embedded preview; use **Original if needed** manually, and never change the receipt's sharing to public. No Drive API scope, paid services, background downloads or receipt caching were introduced.

## Transactions: source vs full bill split (v0.3.7)

Many historical monthly expense rows store only one participant's amount (or nothing) in column H, while the remaining participants are itemized in the Notes or Shared Expenses ledger. For a comparable posted purchase, the new **Other bill portion** field is calculated as **Actual/swiped − My Share**, rounded to cents. It allows the bill amounts displayed in the app to reconcile without altering the spreadsheet's original H value. A **Split check** badge identifies the portion not shown in H, and the original H amount is shown below the derived figure. This is **not** proof that the same amount is owed: some shared portions were already paid, offset, treated, or paid directly by someone else. View the original tracker row for individual shares and repayment status.

Special cases remain separate: a net reimbursement/offset can have an actual transfer smaller than the original personal expense and is marked **Net settlement / offset** rather than fabricated as Others; credits and estimates do not trigger false split warnings. This release changes presentation only. The app remains **read-only** and does not modify any original Google Sheets amounts, formulas, notes, receipt links, payment records, receivables or savings totals. Nine synthetic regression test cases were added; private source values are not committed.

## Frozen transaction table (v0.3.8)

On desktop, open Transactions and scroll the table sideways. **Date** and **Transaction** remain on the left, and **Receipt / Source** remains on the right, while **Actual / Swipe**, **My Share**, **Other bill portion** and **Split check** move. At narrower desktop/tablet widths (up to 1100px), the right edge scrolls normally so numeric columns do not get squeezed. On phone and compact tablet widths (up to 800px), only the Transaction identity remains pinned; Date is included inside the Transaction details so it is never lost. This responsive compromise prevents both frozen edges from obscuring the amounts. Scroll focus can be accessed via keyboard. No tracker values, calculations, OAuth scope, or receipts changed.

## Sorting, text wrap, and spending limits (v0.3.9)

Live Transactions now defaults to **Date: newest first**. Use the sort menu for date, merchant, swipe, My Share, other bill portion, category, payment method, or issues-first; click sortable column headings to toggle their direction. Unconfirmed dates and blank planned swipes stay at the end of applicable sorts. Search and sort can be used together. The Date column grows from 104px to 154px and uses no-wrap, while the frozen transaction-name cell uses natural word wrapping to prevent broken words. On phones, Date remains repeated inside the transaction description.

The read-only Weekly Budget view now explicitly labels **Fixed Weekly Spend Limit (after savings)** and **Spending Left (after savings)**. These figures mirror the authoritative Sheets formulas. In the tracker, the Base Weekly Allowance is before savings, while weekly fixed limit subtracts the allocated savings target. Safe Spending Left incorporates spending, carryover and actual posted credits. The app does not calculate new budgets or alter any Sheet cells.
