# Security review

## Deployment boundary

GitHub Pages serves the application code and synthetic demo only. No private tracker values, receipt files, spreadsheet identifiers, credentials or tokens are bundled. Google authorization happens at Google; financial data is fetched directly from the Google Sheets API into the browser. The app cannot write to trackers or send bank payments. No analytics or application backend receives financial records.

The reviewed static shell is suitable for GitHub Pages within this boundary. Owner OAuth setup and consent have been completed; live reads were verified for both configured workbooks. This is a code review and targeted testing, not an independent penetration test or a promise of zero risk.

## Controls

- Only the Sheets read-only OAuth scope; token lifetime checked before each request. No refresh tokens, client secrets or unencrypted live financial snapshots are stored. The short-lived read-only access token is saved only in tab-scoped `sessionStorage`, never in durable `localStorage`, service-worker caches, snapshots or source. This enables same-tab reload without another authorization popup.
- Restored authorization must match the configured OAuth client and both tracker IDs, the exact read-only scope, the original token expiry (at most one hour) and the five-minute idle deadline. Reload and network reads do not extend either deadline. Corrupt, expired, idle or mismatched sessions are removed. Manual lock, disconnect, demo mode and client/tracker changes clear tab authorization; HTTP 401 clears it before another reload. If session storage is blocked, authorization stays in memory and the UI explains that reload cannot resume.
- Google API endpoint allowlist, no-store requests, no credentials/referrer forwarding. Imported strings are escaped; receipt destinations are limited to HTTPS Google Drive/Docs URLs.
- Content Security Policy restricts scripts to this app and Google's identity library, network to Sheets/Google identity, and blocks plugin content, base URL changes and form submissions. No third-party analytics, fonts, or image requests.
- Source workbook titles, year, required headers and formula-error cells are checked. Reads are bounded to known finance tabs and actual grid dimensions. Oversized tables fail closed rather than show silently partial totals.
- Sign-out/account/cutoff changes invalidate in-flight results. Encrypted offline snapshots require a separate passphrase; keys are non-extractable and not persisted. Saved snapshots have integrity authentication and explicit stale-data labels.
- Service worker caches only exact allowlisted same-origin app assets and deletes only Finance HQ cache names. It never intercepts/caches financial API responses or receipts.
- No credentials, receipts, exports, or real financial fixtures committed. Tests use synthetic inputs.

## Remaining risks and limits

- GitHub Pages project sites share the `shaunlittmanco.github.io` origin. Other code/service workers under that origin must remain trusted. Paths are not separate security origins. Encryption protects locked snapshot content; it cannot protect unlocked data from malicious same-origin code, browser extensions, a compromised device or a future malicious code update.
- The tab token is a bearer credential accessible to same-origin JavaScript, including other trusted Pages project code in that tab. `sessionStorage` is not an encrypted or HTTP-only credential vault. Browser session restore/duplicate-tab behavior may preserve it; expiry and idle checks still apply. This is a bounded reload convenience, not a permanent login or server-enforced session. Do not use it on untrusted/shared devices; use Lock now before leaving.
- Google Sheets read-only authorization is account-wide rather than file-specific; the application narrows requests in its own code. Revoke the app through Google account permissions if no longer needed.
- Offline access is a previously authorized, passphrase-protected snapshot, not a fresh Google authorization. It does not refresh unattended. The app stores no passphrase recovery material. Use a strong unique passphrase and trusted device.
- App idle locking runs while the browser schedules JavaScript; suspended apps lock on return after the idle threshold. It is not an OS security boundary or remote wipe.
- Receipt files remain controlled by their existing Google permissions. The app does not change sharing or download private file copies. Embedded thumbnails and offline receipt files are not provided.
- GitHub Pages cannot set arbitrary HTTP response headers; the app uses a meta CSP. No guarantee of per-origin isolation, server-enforced sessions, or HTTP-only token cookies is made.

## References

- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
