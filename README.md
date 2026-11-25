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

- No accounts. The browser generates a UUID household id stored in
  `localStorage`; that UUID is the capability for its data.
- There is no built-in authentication or per-IP rate limiting. If this is ever
  exposed publicly, put write endpoints behind a gateway with request limits.
- Community counters are a labelled demo baseline (`community_baseline`) plus
  real joins and active households.
- The calculator keeps only the latest assessment per household.
