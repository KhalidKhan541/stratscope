# Email Setup — Gmail SMTP (Transactional Contact Mail)

The API sends transactional email (contact-form keys, confirmations, owner notifications) through Gmail SMTP (`smtp.gmail.com:465`, TLS, AUTH PLAIN with a Gmail **app password**).

Env vars read by the worker:

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `SMTP_HOST` | no | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | no | `465` | TLS port (465 = implicit TLS) |
| `SMTP_USER` | **yes** | — | The Gmail address, e.g. `khalidkhan46572@gmail.com` |
| `SMTP_APP_PASSWORD` | **yes** | — | 16-char Gmail app password (spaces removed) |
| `SMTP_FROM` | no | `SMTP_USER` | Optional sender override |
| `SMTP_SECURE` | no | `true` | Keep `true` for port 465 |

---

## 1. Prerequisites (one-time Gmail setup)

App passwords only exist when **2-Step Verification is ENABLED** on the Gmail account.

1. Sign in to the Gmail account (`khalidkhan46572@gmail.com`).
2. Google Account → **Security** → **2-Step Verification** → turn it **on** (follow the prompts).
3. Back in **Security** → **App passwords** (search "App passwords" if the entry is missing).
4. Create an app password:
   - App: **Mail**
   - Device: **Windows Computer**
5. Google shows a **16-character** password like `abcd efgh ijkl mnop`.
6. **Copy it now** — it is shown only once. Spaces are fine, but remove them when pasting into config: `abcdefghijklmnop`.

> If you already use the account for a mail client (Outlook/Thunderbird), create a *separate* app password for StratScope rather than reusing it.

## 2. Local dev setup (`.dev.vars`)

Create `apps/api/.dev.vars` locally (copy from `.dev.vars.example`):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=khalidkhan46572@gmail.com
SMTP_APP_PASSWORD=abcdefghijklmnop
SMTP_FROM=khalidkhan46572@gmail.com
SMTP_SECURE=true
```

`.dev.vars` is **gitignored** — never commit it. `wrangler dev` loads it automatically.

## 3. Production setup (Cloudflare secrets + vars)

Set the credentials as **secrets** (encrypted, never visible in `wrangler.toml` or CI logs):

```powershell
pnpm --filter @stratscope/api exec wrangler secret put SMTP_USER
pnpm --filter @stratscope/api exec wrangler secret put SMTP_APP_PASSWORD
```

Both prompts are interactive (type the value, press Enter). In production `SMTP_USER` and `SMTP_APP_PASSWORD` **must** come from secrets — never from `vars`.

Non-secret settings go in `wrangler.toml` `vars` (or `wrangler secret put` if you prefer uniform handling):

```toml
vars = { SMTP_HOST = "smtp.gmail.com", SMTP_PORT = "465", SMTP_FROM = "khalidkhan46572@gmail.com", SMTP_SECURE = "true" }
```

Secrets are not visible via `wrangler deploy` output and are redacted in the dashboard. To rotate the app password, re-run the `secret put` commands.

## 4. How it works

Flow for a `POST /v1/contact` request with `request_key: true`:

1. **Rate limit** — the request is checked against a KV counter, keyed by requester email: **max 3 requests/day/email**. Over the limit → 429.
2. **Persist** — a row is inserted into `contact_requests` (request payload + status).
3. **Key generation** — a fresh `sk_live_...` API key is generated **per request**. It is **hashed (SHA-256)** before insert into `api_keys`; the plaintext exists only in the outgoing email.
4. **Email to requester** — the plaintext key is sent to the requester's address **once** (transactional email via Gmail SMTP).
5. **Confirmation + owner notification** — the requester gets a confirmation; `SMTP_USER` gets an owner notification about the new contact request.

The plaintext key is never stored or logged after sending — it cannot be recovered later, only re-issued by requesting a new key.

## 5. Testing (after deploy)

Send a test request from PowerShell (use **your own** test inbox, not a throwaway):

```powershell
Invoke-RestMethod -Method Post -Uri "https://stratscope-api.khalidkhan.workers.dev/v1/contact" -ContentType "application/json" -Body '{"name":"Test","email":"<your own test inbox>","request_key":true}'
```

Expected: HTTP **201** and the key arrives in the test inbox (check spam if missing).

Verify the persisted row in D1:

```powershell
pnpm --filter @stratscope/api exec wrangler d1 execute agent-os-gateway --remote --command "SELECT * FROM contact_requests ORDER BY created_at DESC LIMIT 5;"
```

Check the row's status field — it should be `emailed`/completed (not `failed`).

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| SMTP auth failure (Gmail error **535**) | Wrong app password, or 2-Step Verification is off (no app passwords exist) | Regenerate an app password with 2FA enabled; re-run `secret put SMTP_APP_PASSWORD`; confirm no spaces in the password |
| HTTP **429** | Rate limit hit: 3/day per email | Wait until the next day (UTC); the KV counter resets daily |
| Email not arriving | Spam folder, or Gmail sending limits | Check spam first; Gmail caps ~500 messages/day per account — spread volume across accounts or a dedicated sender if needed |
| Request times out / slow | SMTP connect on port 465 blocked or Gmail latency | Verify egress TLS to `smtp.gmail.com:465`; keep sending work asynchronous (queue/background) so the API responds fast |
| Key never arrives but row exists | Email send failed after insert | Check worker logs for SMTP error; re-send manually or issue a new key |

Never store the SMTP app password in source control, `wrangler.toml`, or `vars` — secrets only.
