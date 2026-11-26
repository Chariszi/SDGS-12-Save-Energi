# SDG 12 Energi — Save Energi

Static campaign site + Rust/PostgreSQL backend for the SEVENT X software engineering competition.

- `index.html`, `js/` — frontend (Tailwind/Lucide/Chart.js via CDN)
- `backend/` — Axum API + SQLx migrations, serves the frontend
- `DATA_REQUIREMENTS.md` — entities, invariants, API contract

## Prerequisites

Rust 1.85+, PostgreSQL 14+.

## Database

Create the app role and database once (run as a PostgreSQL admin):

```sh
psql -h 127.0.0.1 -U postgres -c "CREATE ROLE sdg12_app LOGIN PASSWORD 'choose-a-password';"
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE sdg12_energi OWNER sdg12_app;"
```

Schema and seed data are applied automatically by `sqlx::migrate!` on server
start. The app role owns the database, so it can create its own tables.

## Run

```sh
cd backend
cp .env.example .env        # set DATABASE_URL password
cargo run
```

Open http://127.0.0.1:8080. The binary serves `index.html` and `/js` directly,
so the API is same-origin — no CORS layer.

Environment:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `BIND_ADDR` | `127.0.0.1:8080` | Listen address |
| `COOKIE_SECURE` | unset | `1` adds `Secure` to the session cookie (enable behind HTTPS) |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:8080` | Origin used in verification links |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP relay |
| `SMTP_PORT` | `587` | STARTTLS port |
| `SMTP_USERNAME` | unset | SMTP login, e.g. the Gmail address |
| `SMTP_PASSWORD` | unset | Gmail app password (not the account password) |
| `SMTP_FROM` | `SMTP_USERNAME` | From address |

Without `SMTP_PASSWORD` the server prints the verification link to stderr
instead of sending mail, so local demos work without an inbox. Never rely on
that fallback in production: stderr would contain live tokens.

## Deploy to a home Ubuntu server

One script provisions everything (packages, PostgreSQL role/DB, Rust, systemd
unit) and reruns as a redeploy:

```sh
git clone https://github.com/Chariszi/SDGS-12-Save-Energi.git
cd SDGS-12-Save-Energi
sudo ./scripts/provision-ubuntu.sh
```

It ends by printing `http://<lan-ip>:8080`. Overrides: `REPO`, `BRANCH`,
`PORT`. The unit is `sdg12.service` (`journalctl -u sdg12 -f`).

### Public access without buying a domain

| Option | Stable URL | Needs port forward | Notes |
|---|---|---|---|
| LAN only | no | no | `http://<lan-ip>:8080` |
| Cloudflare quick tunnel | no | no | `cloudflared tunnel --url http://127.0.0.1:8080`, free HTTPS, new URL per run |
| DuckDNS + Caddy | yes | yes | free `<name>.duckdns.org`, Caddy issues Let's Encrypt certs |
| Tailscale | yes | no | private access only, not a public demo link |

DuckDNS + Caddy, in short: point a DuckDNS subdomain at your public IP, forward
TCP 80/443, run Caddy as a reverse proxy to `127.0.0.1:8080`; Caddy gets TLS
automatically. Skip it if your ISP is CGNAT (check the WAN IP against your
router's public IP).

Accounts are required for all writes (Argon2id password hashes, `HttpOnly`
session cookies) and new emails must be verified before first login. Set
`COOKIE_SECURE=1` when serving over HTTPS. There is no per-IP rate limiting, so
put a reverse proxy with limits in front before exposing this beyond a demo.

## Verify

```sh
cd backend
cargo test                  # assessment math, validation, grade boundaries
cargo clippy -- -D warnings

curl -s localhost:8080/api/health
curl -s localhost:8080/api/impact
curl -s "localhost:8080/api/challenges"
```

API contract: `DATA_REQUIREMENTS.md` §4.

## Notes

- Email + password accounts. Passwords are hashed with Argon2id; sessions are
  random 256-bit tokens stored only as SHA-256 hashes, delivered in an
  `HttpOnly; SameSite=Lax` cookie (`Secure` with `COOKIE_SECURE=1`).
- Registration emails a single-use, 24-hour verification link (token stored as
  SHA-256 only). Login is refused with 403 until the address is verified;
  `POST /api/auth/resend` re-sends at most once per minute per account and always
  answers 204 to avoid account enumeration.
- Every write requires a session; the server takes the household from the
  session, never from the request body. Reads may be anonymous.
- Failed logins are capped at 8 per email per 15 minutes. There is no per-IP
  limit, so put a reverse proxy with request limits in front of a public URL.
- Community counters are a labelled demo baseline (`community_baseline`) plus
  real joins and active households.
- The calculator keeps only the latest assessment per household.
