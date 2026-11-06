# Finance HQ renewable Google connection

This is a separate, owner-only data service for the existing GitHub Pages PWA. It uses **Cloudflare Workers Free + D1 Free**. Do not activate a paid plan, purchase a domain, or change any existing application.

The browser uses a passkey to unlock Finance HQ. Google authorization is retained on this server and renewed automatically; the browser never receives Google's refresh/access tokens. A Google grant can still require repair if the owner revokes it or Google expires/rejects it. This is not a promise of permanent Google access.

## Deployment prerequisites

- Owner signs into a Cloudflare account on the **Free** plan. Confirm this before deploying. Exceeding free quotas must fail, not trigger a plan upgrade.
- Create one new D1 database named `finance-hq-session` and fill its returned identifier in `wrangler.jsonc`. Do not reuse another app's database.
- Deploy this Worker to obtain its actual HTTPS `workers.dev` URL. No secrets are bundled, and requests fail closed until configured.
- In the existing Finance HQ Google Cloud project, create a **separate server OAuth Web client**. Its redirect URI must exactly equal `https://<the-new-worker>/oauth/callback`. Keep the existing browser client intact until the new flow is verified.
- Google permissions: `openid`, `email`, and `https://www.googleapis.com/auth/spreadsheets.readonly`. OpenID/email verify that the owner is signing in. There is no Sheets write permission or paid API.
- The OAuth project must be **In production** before issuing the long-lived grant. Google's External/Testing state expires refresh tokens after seven days. Follow any verification required by Google; do not bypass warnings or misrepresent the app's ownership.

## Server configuration

Configure these as private runtime values. Never put their real values in Git, an issue, a PR, command-line arguments, screenshots or this file.

| Key | Value |
| --- | --- |
| `FRONTEND_URL` | Exact existing Pages URL ending `/finance-hq/` |
| `ALLOWED_ORIGIN` | Exact Pages origin, without path or trailing slash |
| `RP_ID` | Pages hostname; passkeys are bound to this host |
| `SERVER_ORIGIN` | Exact new HTTPS `workers.dev` origin |
| `OWNER_EMAIL` | Owner's Google email |
| `GOOGLE_CLIENT_ID` | New server OAuth client's ID |
| `GOOGLE_CLIENT_SECRET` | New server OAuth client's secret |
| `TOKEN_ENCRYPTION_KEY` | Cryptographically random 32 bytes, base64url encoded |
| `SHEET_2026` | Original private 2026 spreadsheet identifier |
| `SHEET_2027` | Original private 2027 spreadsheet identifier |

Use Cloudflare encrypted secrets for the Google secret, encryption key, owner identity and source IDs. Send CLI secret input through stdin, never command arguments or committed files. Keep operational credentials out of logs. Never retrieve the OAuth secret into public code.

```sh
npm --prefix server ci --ignore-scripts
cd server
npx wrangler d1 migrations apply finance-hq-session --remote
npm run check
npm test
npm run build
npm run deploy
```

Account sign-in, accepting service terms, new Google authorization and passkey creation must be completed by the owner where required. Do not use another account or deployment authority to bypass these steps.

## Activate the existing Pages app

After verifying the Worker configuration, run from the project root:

```sh
node scripts/configure-gateway.cjs https://<verified-worker>.workers.dev
npm run check
npm test
npm run build
```

The helper pins the exact server address in both `gateway.js` and the Content Security Policy. Never replace it with a wildcard. Publish the reviewed source to the existing repository/Pages deployment only after the new server passes its security checks.

The owner then opens Settings → First-time setup → **Set up Google access once**, completes Google authorization, and chooses **Enable Face ID / passkey**. Daily unlocks use the passkey. Google setup is also the recovery path for a lost passkey/new device or revoked grant. The browser/OS controls whether Face ID, Touch ID or device passcode is offered.

## Security and verification

- Same-origin-bound OAuth state, nonce, server PKCE and browser verifier-bound, one-use callback ticket.
- Google ID token issuer/audience/nonce/signature and verified owner email checks. Both fixed source books must be readable before retaining the grant.
- AES-256-GCM authenticated encryption at rest; random IVs. Passkey public keys/counters are stored, not biometrics or private passkey keys.
- Passkey verification requires user verification and checks challenge, RP ID, origin, signature and counter. Challenges are short-lived and consumed atomically; credential counter updates use a compare-and-swap.
- App sessions are random 256-bit opaque tokens; only their hashes are stored in D1. Fifteen-minute session windows can renew up to a twelve-hour absolute maximum. Browser idle lock drops the app session while preserving Google's grant.
- The backend only fetches fixed Sheets through GET. It stores no financial snapshot or receipt files. Responses are private/no-store; request/body/provider-token logging is disabled. Other applications and source workbooks are untouched.
- Strict CORS, required JSON, fixed route allowlist, bounded request bodies, per-IP request throttling and expiry cleanup. Anonymous public requests cannot read finances.

Automated tests use synthetic books, actual cryptographic passkey assertions/attestations, mock Google token responses and an in-memory SQLite database. A dry-run Worker build passes. These do **not** prove real Cloudflare deployment, live Google renewal, real iPhone passkey support or physical offline access. Those release checks remain pending until account setup.
