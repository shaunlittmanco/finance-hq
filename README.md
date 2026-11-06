# Finance HQ v0.3.2

A free, mobile-first, read-only personal finance PWA, continued from the original v0.2 package. Static HTML, CSS and JavaScript; no server, paid service, bank API, or AI scanner.

## Features

- Overview, transaction search, linked receipt gallery, budgets and savings, credit-card dues/reconciliation, bills/installments, shared balances, rebates and reports.
- Source-authoritative 16th–15th cutoffs with the July 2026 historical exception. Start-year workbook routing handles December–January. Both tracker layouts are supported.
- Fixed weekly limits and current remaining spending are separate; actual purchases, estimates, reserves, personal shares, reimbursements and issuer payments stay distinct.
- Google Identity Services authorization with only `spreadsheets.readonly`; Sheets requests are GET only. Live data and tokens remain in tab memory.
- Five-minute visible-tab refresh, manual refresh, manual lock and five-minute idle lock.
- Optional encrypted offline snapshot for one cutoff per browser. AES-256-GCM with a random salt/IV and PBKDF2-SHA256 (310,000 iterations). Passphrase and encryption keys are never saved. A snapshot is explicitly labeled with its refresh time. Disconnect deletes the saved snapshot.
- Offline app shell, app-scoped service worker/manifest, iPhone Add to Home Screen and responsive navigation.
- Receipts are private Google file links attached to their original transactions; no Drive permission or public image copies. Image previews open in Google Drive rather than embedded thumbnails.
- Explicitly separate synthetic demo. Keep receipt analysis and expense logging in ChatGPT; this app never writes to Sheets.

## Account setup (required before live use)

1. In your own Google Cloud project, enable Google Sheets API and configure Google Auth Platform. Add your account as a test user if required. No billing account or paid API is needed for this app.
2. Create an OAuth **Web application** client and authorize the JavaScript origin `https://shaunlittmanco.github.io` (no path). Local testing requires its exact localhost origin separately.
3. Open Finance HQ → Settings. Enter the public OAuth client ID and the two original tracker links. These connection settings are stored only in your browser. Never enter or commit a client secret.
4. Click **Connect Google & refresh** and approve read-only access. Google controls account authorization; the read-only Sheets scope can read spreadsheets accessible to the selected account, while the app requests only the selected trackers.
5. On iPhone, open the HTTPS app in Safari → Share → Add to Home Screen. Authorize again after a reload/token expiry. Offline data requires a previously saved encrypted snapshot and its passphrase.

A ChatGPT Google Drive connection does not authorize this separate browser app. Google Cloud account verification and the app's OAuth consent must be completed by the account owner.

## Development

```sh
npm run check
npm test
npm run build
```

No dependency install is needed. `build` creates an allowlisted `dist/` containing only the public shell. For GitHub Pages, publish `main` / root; `.nojekyll` disables Jekyll. Tests and fixtures contain invented examples only. Never add exports, receipts, real-data fixtures, tokens, credentials, passphrases, or private snapshots to this repository.

## Validation and release status

- 22 automated tests cover parsing, workbook routing, OAuth browser scope, canceled authorization, receipt URLs, source header/formula errors, encryption, tampering, XSS escaping and offline shell cache behavior.
- Private read-only source validation covered all 18 available cutoffs across the two workbooks, with 2,763 numeric comparisons. Source data and the private validation inputs are deliberately excluded from this repository.
- Browser checks covered all eight sections plus settings at desktop size, and 390/430 px iPhone-sized layouts, transaction navigation and connection settings.
- Live Google OAuth authorization and all eight sections were verified against both configured workbooks. Encrypted snapshot save, wrong-passphrase rejection, manual lock, reload and successful unlock were verified in the deployed browser. The temporary QA snapshot was deleted afterward.
- Real-device Safari/Add to Home Screen and a physical device airplane-mode roundtrip remain pending. Browser layout checks do not substitute for native Safari testing.
- v0.3.1 fixes apostrophe rendering in live merchant names; no financial calculation changed.

See [SECURITY.md](SECURITY.md) for the deployment boundary and remaining risks.

- v0.3.2 versions app script/style URLs to prevent mixed cached assets during updates.
