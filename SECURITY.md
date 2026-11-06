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

## v0.4.0 renewable connection — pending activation

The separate server and passkey client are prepared but not enabled. The empty `gateway.js` endpoint preserves the current v0.3.4 connector until deployment and owner authorization. The controls above describe that legacy connector; this section describes the proposed activated path.

On activation, encrypted Google refresh/access credentials live only in the new private server's D1 database, with its AES-256-GCM key held separately in encrypted runtime secrets. Google authorization requests include the existing Sheets read-only scope plus OpenID/email for verifying the sole owner's identity. Both source books are checked before retaining access. Google signature/nonce/state/PKCE and a browser-verifier-bound callback ticket are validated. Read APIs accept only supported cutoff IDs and use server-owned spreadsheet IDs; there is no arbitrary URL proxy or Sheets write route.

The browser instead receives a random, short-lived Finance HQ app session. D1 stores only its hash. Sessions can renew during active use but have a twelve-hour absolute maximum. Five-minute idle locking clears/revokes the app session without revoking the Google grant. Passkey authentication requires a verified device user, matching RP ID/origin, a valid signature, counter checks and one-use expiring challenges. Passkeys can be enrolled only after a recent verified Google setup. No biometric data or private passkey key is transmitted to or stored by this app.

The frontend remains on GitHub Pages. The exact new backend origin must be pinned in CSP before activation. API calls omit cookies, avoiding reliance on third-party cookie availability. App tokens remain accessible to same-origin JavaScript in the active tab; other Pages projects under the same origin must still be trusted. This does not create HTTP-only cookies or isolate project paths.

The free backend temporarily processes finance responses over HTTPS but stores no financial records or receipt files. Request/provider-token/body logging is disabled. All finance responses are private/no-store. Cloudflare Workers Free and D1 Free have quotas; exceeding them must produce an error, not enable a paid plan.

Release requires Cloudflare owner sign-in, encrypted runtime configuration, a separate server OAuth client, Google production publishing/authorization, live token renewal, and real-device passkey testing. The code/build/fixture checks do not establish those results. Google can revoke or expire a renewable grant; never promise that reconnect will be impossible or permanently unnecessary.
