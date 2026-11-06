# Finance HQ — secure session upgrade (v0.4.0)

Continued from the original v0.2 app; the existing desktop/mobile dashboard and source-authoritative financial rules are preserved. The public Pages app is currently **v0.3.4**. This upgrade is prepared for a separate free session server; it is **not enabled in production yet**.

## What changes

- Google access renews on a private server, rather than requiring an hourly browser reconnect.
- Passkey unlock replaces the Google prompt during ordinary app access. On supported iPhones, this can use Face ID or device passcode.
- Reload resumes a valid tab session. Five-minute idle locking clears the app session while retaining the renewable Google grant; the next unlock uses a passkey.
- Google authorization is used for initial setup, adding a passkey/new device, and repairing a grant that Google revoked or expired. No automatic consent bypass is attempted.
- Source figures, cutoff routing, budgets, savings, reimbursements, installments, card reconciliation, receipt links and the ChatGPT logging workflow are unchanged. The backend remains read-only.

## Release status

The server endpoint in `gateway.js` is intentionally empty. That leaves the existing browser connector active until the new server is configured and verified. See [server/README.md](server/README.md) for the complete deployment and owner-authorization steps.

No paid service, real financial data, private spreadsheet identifier, OAuth secret or token is included in this repository. Cloudflare Workers and D1 must remain on their Free plans. The Google OAuth project must leave Testing before issuing the renewable grant, because Testing refresh tokens expire after seven days.

## Existing features

Overview, searchable transactions, receipts linked to their exact source rows, budget/savings, credit-card dues and reconciliation, bills/installments, shared balances, rebates and reports. Source-authoritative 16th–15th cutoffs include the July 2026 historical exception and December–January workbook routing. Estimates, reserves, personal shares, reimbursements and card issuer payments remain distinct.

The app caches only its shell. Optional offline snapshots are encrypted using AES-256-GCM and PBKDF2-SHA256 (310,000 iterations); passphrases/keys are never saved. Snapshot unlock still uses its separate passphrase. Receipt files retain their existing Google permissions and require internet; no private receipt copies or paid AI scanning are added.

## Validation

```sh
npm run check
npm test
npm run build
npm --prefix server ci --ignore-scripts
npm --prefix server run check
npm --prefix server test
npm --prefix server run build
```

All 65 automated tests pass (49 frontend/finance and 16 backend tests), using invented inputs only. The new unlock and first-time setup screens were also checked in a desktop browser preview. Production dependencies have no reported vulnerabilities in the package audit. New tests cover passkey signatures and attestations, replay/origin/user-verification rejection, Google renewal and revocation, encrypted credentials, session renewal/deadlines, callback PKCE and private/no-store responses.

Earlier production validation covered 18 available source cutoffs with 2,763 numeric comparisons and both workbook layouts. Desktop, 390/430 px layouts, live source sections and encrypted snapshot save/lock/unlock were verified for the earlier production app. The new hosted flow still needs actual Cloudflare/Google authorization, live renewal, browser checks and an actual iPhone Safari/Add to Home Screen test before it is called released.

See [SECURITY.md](SECURITY.md) for the deployment boundary and remaining risks.
