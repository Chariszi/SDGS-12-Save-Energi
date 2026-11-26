# SDG 12 Energi — Data Requirements

Derived from `index.html` and `js/*.js`. Source of truth for the API and PostgreSQL schema.

## 1. Domain scope

The site has five stateful features. Everything else is static content or client-side chart data.

| Feature | State | Persistence |
|---|---|---|
| Community impact ticker + dashboard | kWh saved, CO₂ prevented, households, Rp saved, category distribution | Aggregated from baseline + live rows |
| Challenge board | Challenge cards, join state, join count | `challenges`, `challenge_joins` |
| Daily action checklist (`calculator.html#aksi`) | Six actions, completion state, pledge points | `pledges`, `pledge_completions` |
| Energy calculator (`calculator.html`) | Inputs, before/after comparison (kWh, CO₂, cost, trees), recommendations | Latest "before" result per household in `energy_assessments` |
| Personal score | 20/join + 30/challenge created + pledge points | Derived, never stored |

Email + password login with email verification. Each user owns exactly one
household, resolved server-side from the session cookie; the client never sends
a household id for writes.

## 2. Entities

### households
| Column | Type | Rules |
|---|---|---|
| id | UUID PK | Client-generated v4, or server default |
| display_name | TEXT NULL | Trimmed, 1–60 chars when present |
| created_at | TIMESTAMPTZ | Server `now()` |

### users
| Column | Type | Rules |
|---|---|---|
| id | UUID PK | Server-generated |
| household_id | UUID UNIQUE FK households | `ON DELETE CASCADE`; created with the account |
| email | TEXT | Stored lowercased, 3–254 chars, unique case-insensitively |
| email_verified_at | TIMESTAMPTZ NULL | Set when the mailed link is clicked; login is refused while NULL |
| password_hash | TEXT | Argon2id PHC string, never logged |
| created_at | TIMESTAMPTZ | Server `now()` |

### sessions
`token_hash` TEXT PK = SHA-256 of the 256-bit cookie token (the raw token is never
stored), `user_id` FK users `ON DELETE CASCADE`, `expires_at` (14 days),
`created_at`. Expired rows are purged on login and logout.

### email_verification_tokens
`token_hash` TEXT PK = SHA-256 of the 256-bit link token (raw token only exists
in the email), `user_id` FK users `ON DELETE CASCADE`, `expires_at` (24 hours),
`created_at`. Single use: consumed or replaced on resend; at most one per user.

### auth_attempts
Append-only log of login outcomes (`email`, `success`, `attempted_at`). Login is
refused (429) when an email has ≥ 8 failures in the last 15 minutes; rows older
than a day are pruned.

### challenges
| Column | Type | Rules |
|---|---|---|
| id | BIGINT identity PK | |
| household_id | UUID FK households, NULL for seed | `ON DELETE SET NULL` |
| category | TEXT | `listrik` \| `transportasi` \| `terbarukan` |
| title | TEXT | 5–120 chars after trim |
| description | TEXT | 10–800 chars after trim |
| kwh_saved | DOUBLE PRECISION | 0.1–100000 for user rows; 0–100000 for seed |
| co2_saved | DOUBLE PRECISION | ≥ 0; derived `kwh * 0.85` for user rows |
| location | TEXT | 2–80 chars after trim |
| time_label | TEXT | Display label, default `Baru saja` |
| created_at | TIMESTAMPTZ | Server `now()` |

Invariant: creating a challenge awards points but does **not** count as energy saved. Only a join claims the saving.

### challenge_joins
`(household_id, challenge_id)` composite PK, both FKs `ON DELETE CASCADE`. A join is idempotent and awards 20 points once.

### pledges
Seeded catalogue only: `code` PK, `title`, `description`, `category`, `points` (1–100), `sort_order`.

### pledge_completions
`(household_id, pledge_code)` composite PK, both FKs `ON DELETE CASCADE`, `completed_at`. Presence = completed.

### energy_assessments
One current row per household (`household_id` PK), upserted by the calculator. Stores normalized inputs and the computed outputs (`effective_kwh`, `total_co2_kg`, `cost_rp`, `grade A–E`, `updated_at`). No history: the UI has no history view; add an append-only table if that changes.

### community_baseline
Singleton row (`id BOOLEAN PRIMARY KEY CHECK (id)`) holding the demo campaign counters shown before real activity: kWh, CO₂, households. It is seed/demo data, not measured production data. Live totals = baseline + joined challenges + registered households.

## 3. Derivation rules

Constants (same as the incumbent client):
- tariff `1_445 Rp/kWh`
- grid emission factor `0.85 kg CO₂e/kWh`
- transport monthly CO₂: `public=25`, `motor=65`, `car=180`
- AC load above 8 h/day: `18 kWh` per extra hour
- LED: ×0.92; unplug standby: ×0.93; both: ×0.85
- grade: A ≤220, B ≤360, C ≤550, D ≤800, E >800 kg CO₂/month
- trees: `max(1, ceil(co2 / 18))`

Impact:
- `kwh_saved = baseline.kwh_saved + Σ joined_challenge.kwh_saved`
- `co2_prevented = baseline.co2_prevented + Σ joined_challenge.co2_saved`
- `households = baseline.households + count(active households)`; a household is active once it has a join, pledge completion, or created challenge. Registration and a calculator-only visit do not inflate the public counter.
- `rp_saved_million = round(kwh_saved * 1445 / 1_000_000)`
- `distribution[*] = join share by category`: floors are assigned first, then leftover percentage points go to the largest fractional remainders among categories that actually have joins, so the three bars total exactly 100% and an absent category stays at 0. With no joins, the seeded `62 / 25 / 13` display split is returned.

Score:
- `20 × joins + 30 × challenges created by household + Σ completed pledge points`

## 4. API contract

Base path `/api`. JSON in/out, camel-free snake_case. Errors: `{ "error": "message" }` with 400 (validation or malformed JSON), 404 (unknown household/challenge), 429 (creation cap), and 500 (internal, detail logged server-side).

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | — | `{status:"ok"}` |
| POST | `/auth/register` | `{email, password, display_name}` | 201 `{email, display_name, verification_required:true}`; emails a verification link; 409 if email taken |
| POST | `/auth/login` | `{email, password}` | user + session cookie; 401 wrong credentials, 403 unverified email, 429 after 8 failures/15 min per email |
| POST | `/auth/logout` | — | 204, clears cookie and deletes the session row |
| GET | `/auth/me` | — | current user; 401 when anonymous |
| GET | `/auth/verify?token=` | — | consumes the link token, 303 to `/login.html?verified=1` (or `verified=invalid`) |
| POST | `/auth/resend` | `{email}` | always 204; re-sends the verification link if the account exists, is unverified, and the last token is older than 60 s |
| GET | `/impact` | — | `{kwh_saved, co2_prevented, households, rp_saved_million, distribution:{listrik,transportasi,terbarukan}}` |
| GET | `/challenges` | — | challenge array (`id, category, title, description, kwh, co2, location, time, joined, join_count`) newest first, max 200; `joined` reflects the session user |
| POST | `/challenges` | `{category, title, description, kwh, location}` | 201 challenge; max 20 per household/day (429); 401 anonymous |
| POST | `/challenges/{id}/join` | — | `{joined:true, awarded:bool}`; idempotent; 401 anonymous |
| GET | `/pledges` | — | pledge array with `completed` for the session user |
| PUT | `/pledges/{code}` | `{completed}` | `{code, completed, points}`; 401 anonymous |
| POST | `/assessments` | `{kwh_monthly, ac_hours, transport, led, unplug}` | `{before, after, saved_kwh, saved_co2_kg, saved_cost_rp, saved_cost_yearly_rp, saved_trees}`; the improved scenario forces LED, unplug, and AC ≤ 8 h; only `before` is persisted; 401 anonymous |
| GET | `/score` | — | `{total, challenges_joined, challenges_created, pledge_points}`; 401 anonymous |

Validation is server-side at every boundary. Values are range/enum checked, strings trimmed and length checked, SQL is parameterized, JSON body capped at 16 KiB. `GET /api/impact` and the challenge/pledge listings are public; every write requires a session, and ownership comes from the session cookie, never the request body.

## 5. Seed data

- 6 challenge rows matching the original `challenges.js` fixtures.
- 6 pledge rows matching the checklist in `calculator.html`.
- `community_baseline`: `3890 kWh`, `6412 kg CO₂e`, `1248 households`.

Seed rows are labelled as campaign baseline, not measured results.

## 6. Non-goals

Admin moderation, multi-campaign tenancy, assessment history, offline sync, and real-time push. The ticker polls every 15 s.
