# Security review

## Deployment boundary

GitHub Pages serves the application code and synthetic demo only. No private tracker values, receipt files, spreadsheet identifiers, credentials or tokens are bundled. Google authorization happens at Google; financial data is fetched directly from the Google Sheets API into the browser. The app cannot write to trackers or send bank payments. No analytics or application backend receives financial records.

The reviewed static shell is suitable for GitHub Pages within this boundary. Owner OAuth setup and consent have been completed; live reads were verified for both configured workbooks. This is a code review and targeted testing, not an independent penetration test or a promise of zero risk.

## Controls

- Only the Sheets read-only OAuth scope; token lifetime checked before each request. No refresh tokens, client secrets, access tokens, or unencrypted live snapshots in browser storage or source.
- Google API endpoint allowlist, no-store requests, no credentials/referrer forwarding. Imported strings are escaped; receipt destinations are limited to HTTPS Google Drive/Docs URLs.
- Content Security Policy restricts scripts to this app and Google's identity library, network to Sheets/Google identity, and blocks plugin content, base URL changes and form submissions. No third-party analytics, fonts, or image requests.
- Source workbook titles, year, required headers and formula-error cells are checked. Reads are bounded to known finance tabs and actual grid dimensions. Oversized tables fail closed rather than show silently partial totals.
- Sign-out/account/cutoff changes invalidate in-flight results. Encrypted offline snapshots require a separate passphrase; keys are non-extractable and not persisted. Saved snapshots have integrity authentication and explicit stale-data labels.
- Service worker caches only exact allowlisted same-origin app assets and deletes only Finance HQ cache names. It never intercepts/caches financial API responses or receipts.
- No credentials, receipts, exports, or real financial fixtures committed. Tests use synthetic inputs.

## Remaining risks and limits

- GitHub Pages project sites share the `shaunlittmanco.github.io` origin. Other code/service workers under that origin must remain trusted. Paths are not separate security origins. Encryption protects locked snapshot content; it cannot protect unlocked data from malicious same-origin code, browser extensions, a compromised device or a future malicious code update.
- Google Sheets read-only authorization is account-wide rather than file-specific; the application narrows requests in its own code. Revoke the app through Google account permissions if no longer needed.
- Offline access is a previously authorized, passphrase-protected snapshot, not a fresh Google authorization. It does not refresh unattended. The app stores no passphrase recovery material. Use a strong unique passphrase and trusted device.
- App idle locking runs while the browser schedules JavaScript; suspended apps lock on return after the idle threshold. It is not an OS security boundary or remote wipe.
- Receipt files remain controlled by their existing Google permissions. The app does not change sharing or download private file copies. Embedded thumbnails and offline receipt files are not provided.
- GitHub Pages cannot set arbitrary HTTP response headers; the app uses a meta CSP. No guarantee of per-origin isolation, server-enforced sessions, or HTTP-only token cookies is made.

## References

- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto
