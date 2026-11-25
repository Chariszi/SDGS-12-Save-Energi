use axum::{
    extract::{rejection::JsonRejection, DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::calc::{AssessmentComparison, AssessmentInput};

const MAX_CHALLENGES_PER_DAY: i64 = 20;

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route(
            "/health",
            get(|| async { Json(serde_json::json!({ "status": "ok" })) }),
        )
        .route("/households", post(create_household))
        .route("/households/{id}/score", get(get_score))
        .route("/impact", get(get_impact))
        .route("/challenges", get(list_challenges).post(create_challenge))
        .route("/challenges/{id}/join", post(join_challenge))
        .route("/pledges", get(list_pledges))
        .route("/pledges/{code}", put(set_pledge))
        .route("/assessments", post(create_assessment))
        .layer(DefaultBodyLimit::max(16 * 1024))
        .with_state(pool)
}

#[derive(Debug)]
enum ApiError {
    BadRequest(String),
    NotFound(String),
    TooManyRequests(String),
    Internal(sqlx::Error),
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        ApiError::Internal(error)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            ApiError::NotFound(message) => (StatusCode::NOT_FOUND, message),
            ApiError::TooManyRequests(message) => {
                (StatusCode::TOO_MANY_REQUESTS, message)
            }
            ApiError::Internal(error) => {
                eprintln!("database error: {error}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal server error".to_string(),
                )
            }
        };

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}

async fn ensure_household(pool: &PgPool, id: Uuid) -> Result<(), ApiError> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM households WHERE id = $1)")
            .bind(id)
            .fetch_one(pool)
            .await?;

    if exists {
        Ok(())
    } else {
        Err(ApiError::NotFound("household not found".into()))
    }
}

fn clean(
    value: &str,
    field: &str,
    min: usize,
    max: usize,
) -> Result<String, ApiError> {
    let trimmed = value.trim();
    let length = trimmed.chars().count();

    if length < min || length > max {
        return Err(ApiError::BadRequest(format!(
            "{field} must be {min}-{max} characters"
        )));
    }

    Ok(trimmed.to_string())
}

// Route malformed JSON through the same JSON error envelope as the rest of the API.
fn json_body<T>(
    payload: Result<Json<T>, JsonRejection>,
) -> Result<T, ApiError> {
    payload
        .map(|Json(value)| value)
        .map_err(|rejection| ApiError::BadRequest(rejection.body_text()))
}

fn parse_uuid(value: &str, field: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(value)
        .map_err(|_| ApiError::BadRequest(format!("{field} must be a valid UUID")))
}

fn parse_optional_uuid(
    value: Option<&str>,
    field: &str,
) -> Result<Option<Uuid>, ApiError> {
    match value {
        Some(raw) => Ok(Some(parse_uuid(raw, field)?)),
        None => Ok(None),
    }
}

// ── Households ────────────────────────────────────────────────

#[derive(Deserialize)]
struct NewHousehold {
    id: Option<Uuid>,
    display_name: Option<String>,
}

#[derive(Serialize, FromRow)]
struct HouseholdOut {
    id: Uuid,
    display_name: Option<String>,
}

async fn create_household(
    State(pool): State<PgPool>,
    payload: Result<Json<NewHousehold>, JsonRejection>,
) -> Result<Json<HouseholdOut>, ApiError> {
    let body = json_body(payload)?;

    let display_name = match body.display_name.as_deref().map(str::trim) {
        Some("") | None => None,
        Some(name) => Some(clean(name, "display_name", 1, 60)?),
    };

    let id = body.id.unwrap_or_else(Uuid::new_v4);

    let household = sqlx::query_as::<_, HouseholdOut>(
        "INSERT INTO households (id, display_name)
         VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE
           SET display_name = COALESCE(households.display_name, EXCLUDED.display_name)
         RETURNING id, display_name",
    )
    .bind(id)
    .bind(display_name)
    .fetch_one(&pool)
    .await?;

    Ok(Json(household))
}

#[derive(Serialize, FromRow)]
struct Score {
    total: i64,
    challenges_joined: i64,
    challenges_created: i64,
    pledge_points: i64,
}

async fn get_score(
    State(pool): State<PgPool>,
    Path(raw_id): Path<String>,
) -> Result<Json<Score>, ApiError> {
    let id = parse_uuid(&raw_id, "household_id")?;
    ensure_household(&pool, id).await?;

    let score = sqlx::query_as::<_, Score>(
        "SELECT
           (SELECT count(*) FROM challenge_joins WHERE household_id = $1) * 20
           + (SELECT count(*) FROM challenges WHERE household_id = $1) * 30
           + COALESCE((SELECT sum(p.points) FROM pledge_completions pc
                       JOIN pledges p ON p.code = pc.pledge_code
                       WHERE pc.household_id = $1), 0) AS total,
           (SELECT count(*) FROM challenge_joins WHERE household_id = $1) AS challenges_joined,
           (SELECT count(*) FROM challenges WHERE household_id = $1) AS challenges_created,
           COALESCE((SELECT sum(p.points) FROM pledge_completions pc
                     JOIN pledges p ON p.code = pc.pledge_code
                     WHERE pc.household_id = $1), 0) AS pledge_points",
    )
    .bind(id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(score))
}

// ── Impact ────────────────────────────────────────────────────

#[derive(Serialize, Debug)]
struct Distribution {
    listrik: i64,
    transportasi: i64,
    terbarukan: i64,
}

fn distribution_for(rows: &[(String, i64)]) -> Distribution {
    let total: i64 = rows.iter().map(|(_, count)| *count).sum();

    if total == 0 {
        return Distribution {
            listrik: 62,
            transportasi: 25,
            terbarukan: 13,
        };
    }

    let mut distribution = Distribution {
        listrik: 0,
        transportasi: 0,
        terbarukan: 0,
    };

    let mut remainders: Vec<(String, f64)> = Vec::new();

    for (category, count) in rows {
        if !matches!(
            category.as_str(),
            "listrik" | "transportasi" | "terbarukan"
        ) {
            continue;
        }

        let exact = *count as f64 * 100.0 / total as f64;
        let floor = exact.floor() as i64;

        match category.as_str() {
            "listrik" => distribution.listrik = floor,
            "transportasi" => distribution.transportasi = floor,
            _ => distribution.terbarukan = floor,
        }

        remainders.push((category.clone(), exact - floor as f64));
    }

    let mut leftover =
        100 - (distribution.listrik
            + distribution.transportasi
            + distribution.terbarukan);

    remainders.sort_by(|a, b| {
        b.1.total_cmp(&a.1)
            .then_with(|| a.0.cmp(&b.0))
    });

    for (category, _) in remainders {
        if leftover <= 0 {
            break;
        }

        match category.as_str() {
            "listrik" => distribution.listrik += 1,
            "transportasi" => distribution.transportasi += 1,
            _ => distribution.terbarukan += 1,
        }

        leftover -= 1;
    }

    distribution
}

#[derive(Serialize)]
struct Impact {
    kwh_saved: f64,
    co2_prevented: f64,
    households: i64,
    rp_saved_million: i64,
    distribution: Distribution,
}

#[derive(FromRow)]
struct ImpactTotals {
    kwh: f64,
    co2: f64,
    households: i64,
}

async fn get_impact(
    State(pool): State<PgPool>,
) -> Result<Json<Impact>, ApiError> {
    let totals = sqlx::query_as::<_, ImpactTotals>(
        "SELECT
           b.kwh_saved + COALESCE((SELECT sum(c.kwh_saved) FROM challenge_joins j
                                   JOIN challenges c ON c.id = j.challenge_id), 0) AS kwh,
           b.co2_prevented + COALESCE((SELECT sum(c.co2_saved) FROM challenge_joins j
                                       JOIN challenges c ON c.id = j.challenge_id), 0) AS co2,
           b.households + (SELECT count(*) FROM households h WHERE
             EXISTS (SELECT 1 FROM challenge_joins j WHERE j.household_id = h.id)
             OR EXISTS (SELECT 1 FROM pledge_completions pc WHERE pc.household_id = h.id)
             OR EXISTS (SELECT 1 FROM challenges c WHERE c.household_id = h.id)
           ) AS households
         FROM community_baseline b WHERE b.id",
    )
    .fetch_one(&pool)
    .await?;

    let rows: Vec<(String, i64)> = sqlx::query_as(
        "SELECT c.category, count(*)
         FROM challenge_joins j
         JOIN challenges c ON c.id = j.challenge_id
         GROUP BY c.category",
    )
    .fetch_all(&pool)
    .await?;

    let total: i64 = rows.iter().map(|(_, count)| *count).sum();

    let distribution = if total > 0 {
        distribution_for(&rows)
    } else {
        Distribution {
            listrik: 62,
            transportasi: 25,
            terbarukan: 13,
        }
    };

    Ok(Json(Impact {
        kwh_saved: totals.kwh,
        co2_prevented: totals.co2,
        households: totals.households,
        rp_saved_million: (totals.kwh * 1445.0 / 1_000_000.0).round() as i64,
        distribution,
    }))
}

// ── Challenges ────────────────────────────────────────────────

#[derive(Debug, Serialize, FromRow)]
struct Challenge {
    id: i64,
    category: String,
    title: String,
    description: String,
    kwh: f64,
    co2: f64,
    location: String,
    time: String,
    joined: bool,
    join_count: i64,
}

#[derive(Deserialize)]
struct ChallengeQuery {
    household_id: Option<String>,
}

async fn list_challenges(
    State(pool): State<PgPool>,
    Query(query): Query<ChallengeQuery>,
) -> Result<Json<Vec<Challenge>>, ApiError> {
    let household_id =
        parse_optional_uuid(query.household_id.as_deref(), "household_id")?;

    if let Some(id) = household_id {
        ensure_household(&pool, id).await?;
    }

    let challenges = sqlx::query_as::<_, Challenge>(
        "SELECT c.id, c.category, c.title, c.description,
                c.kwh_saved AS kwh, c.co2_saved AS co2, c.location,
                c.time_label AS time,
                EXISTS (SELECT 1 FROM challenge_joins j
                        WHERE j.challenge_id = c.id AND j.household_id = $1) AS joined,
                (SELECT count(*) FROM challenge_joins j
                 WHERE j.challenge_id = c.id) AS join_count
         FROM challenges c
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT 200",
    )
    .bind(household_id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(challenges))
}

#[derive(Deserialize)]
struct NewChallenge {
    household_id: Uuid,
    category: String,
    title: String,
    description: String,
    kwh: f64,
    location: String,
}

async fn create_challenge(
    State(pool): State<PgPool>,
    payload: Result<Json<NewChallenge>, JsonRejection>,
) -> Result<(StatusCode, Json<Challenge>), ApiError> {
    let body = json_body(payload)?;

    if !matches!(
        body.category.as_str(),
        "listrik" | "transportasi" | "terbarukan"
    ) {
        return Err(ApiError::BadRequest(
            "category must be listrik, transportasi, or terbarukan".into(),
        ));
    }

    let title = clean(&body.title, "title", 5, 120)?;
    let description = clean(&body.description, "description", 10, 800)?;
    let location = clean(&body.location, "location", 2, 80)?;

    if !body.kwh.is_finite() || !(0.1..=100_000.0).contains(&body.kwh) {
        return Err(ApiError::BadRequest(
            "kwh must be between 0.1 and 100000".into(),
        ));
    }

    let co2 = (body.kwh * 0.85 * 10.0).round() / 10.0;
    let mut tx = pool.begin().await?;

    let locked: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM households WHERE id = $1 FOR UPDATE")
            .bind(body.household_id)
            .fetch_optional(&mut *tx)
            .await?;

    if locked.is_none() {
        return Err(ApiError::NotFound("household not found".into()));
    }

    let recent: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM challenges
         WHERE household_id = $1 AND created_at > now() - interval '1 day'",
    )
    .bind(body.household_id)
    .fetch_one(&mut *tx)
    .await?;

    if recent >= MAX_CHALLENGES_PER_DAY {
        return Err(ApiError::TooManyRequests(
            "daily challenge creation limit reached".into(),
        ));
    }

    let challenge = sqlx::query_as::<_, Challenge>(
        "INSERT INTO challenges
           (household_id, category, title, description, kwh_saved, co2_saved, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, category, title, description,
                   kwh_saved AS kwh, co2_saved AS co2, location,
                   time_label AS time, FALSE AS joined, 0::bigint AS join_count",
    )
    .bind(body.household_id)
    .bind(&body.category)
    .bind(&title)
    .bind(&description)
    .bind(body.kwh)
    .bind(co2)
    .bind(&location)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok((StatusCode::CREATED, Json(challenge)))
}

#[derive(Deserialize)]
struct JoinBody {
    household_id: Uuid,
}

#[derive(Serialize)]
struct JoinOutcome {
    joined: bool,
    awarded: bool,
}

async fn join_challenge(
    State(pool): State<PgPool>,
    Path(raw_id): Path<String>,
    payload: Result<Json<JoinBody>, JsonRejection>,
) -> Result<Json<JoinOutcome>, ApiError> {
    let id: i64 = raw_id
        .parse()
        .map_err(|_| ApiError::BadRequest("challenge id must be a number".into()))?;

    let body = json_body(payload)?;
    ensure_household(&pool, body.household_id).await?;

    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM challenges WHERE id = $1)")
            .bind(id)
            .fetch_one(&pool)
            .await?;

    if !exists {
        return Err(ApiError::NotFound("challenge not found".into()));
    }

    let inserted: Option<i32> = sqlx::query_scalar(
        "INSERT INTO challenge_joins (household_id, challenge_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING 1",
    )
    .bind(body.household_id)
    .bind(id)
    .fetch_optional(&pool)
    .await?;

    Ok(Json(JoinOutcome {
        joined: true,
        awarded: inserted.is_some(),
    }))
}

// ── Pledges ───────────────────────────────────────────────────

#[derive(Serialize, FromRow)]
struct Pledge {
    code: String,
    title: String,
    description: String,
    category: String,
    points: i16,
    completed: bool,
}

async fn list_pledges(
    State(pool): State<PgPool>,
    Query(query): Query<ChallengeQuery>,
) -> Result<Json<Vec<Pledge>>, ApiError> {
    let household_id =
        parse_optional_uuid(query.household_id.as_deref(), "household_id")?;

    if let Some(id) = household_id {
        ensure_household(&pool, id).await?;
    }

    let pledges = sqlx::query_as::<_, Pledge>(
        "SELECT p.code, p.title, p.description, p.category, p.points,
                EXISTS (SELECT 1 FROM pledge_completions pc
                        WHERE pc.household_id = $1 AND pc.pledge_code = p.code) AS completed
         FROM pledges p
         ORDER BY p.sort_order",
    )
    .bind(household_id)
    .fetch_all(&pool)
    .await?;

    Ok(Json(pledges))
}

#[derive(Deserialize)]
struct PledgeBody {
    household_id: Uuid,
    completed: bool,
}

#[derive(Serialize)]
struct PledgeOutcome {
    code: String,
    completed: bool,
    points: i16,
}

async fn set_pledge(
    State(pool): State<PgPool>,
    Path(code): Path<String>,
    payload: Result<Json<PledgeBody>, JsonRejection>,
) -> Result<Json<PledgeOutcome>, ApiError> {
    let body = json_body(payload)?;
    ensure_household(&pool, body.household_id).await?;

    let points: Option<i16> =
        sqlx::query_scalar("SELECT points FROM pledges WHERE code = $1")
            .bind(&code)
            .fetch_optional(&pool)
            .await?;

    let Some(points) = points else {
        return Err(ApiError::NotFound("pledge not found".into()));
    };

    if body.completed {
        sqlx::query(
            "INSERT INTO pledge_completions (household_id, pledge_code)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING",
        )
        .bind(body.household_id)
        .bind(&code)
        .execute(&pool)
        .await?;
    } else {
        sqlx::query(
            "DELETE FROM pledge_completions
             WHERE household_id = $1 AND pledge_code = $2",
        )
        .bind(body.household_id)
        .bind(&code)
        .execute(&pool)
        .await?;
    }

    Ok(Json(PledgeOutcome {
        code,
        completed: body.completed,
        points,
    }))
}

// ── Assessments ───────────────────────────────────────────────

#[derive(Deserialize)]
struct AssessmentBody {
    household_id: Uuid,
    kwh_monthly: i32,
    ac_hours: i32,
    transport: crate::calc::Transport,
    led: bool,
    unplug: bool,
}

async fn create_assessment(
    State(pool): State<PgPool>,
    payload: Result<Json<AssessmentBody>, JsonRejection>,
) -> Result<Json<AssessmentComparison>, ApiError> {
    let body = json_body(payload)?;

    ensure_household(&pool, body.household_id).await?;

    let input = AssessmentInput {
        kwh_monthly: body.kwh_monthly,
        ac_hours: body.ac_hours,
        transport: body.transport,
        led: body.led,
        unplug: body.unplug,
    };

    input.validate().map_err(ApiError::BadRequest)?;

    // Calculate both the current and improved scenarios.
    let result = input.calculate_comparison();

    // Persist the user's actual/current assessment, not the simulation.
    sqlx::query(
        "INSERT INTO energy_assessments
           (household_id, kwh_monthly, ac_hours, transport, led, unplug,
            effective_kwh, total_co2_kg, cost_rp, grade)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (household_id) DO UPDATE SET
           kwh_monthly = EXCLUDED.kwh_monthly,
           ac_hours = EXCLUDED.ac_hours,
           transport = EXCLUDED.transport,
           led = EXCLUDED.led,
           unplug = EXCLUDED.unplug,
           effective_kwh = EXCLUDED.effective_kwh,
           total_co2_kg = EXCLUDED.total_co2_kg,
           cost_rp = EXCLUDED.cost_rp,
           grade = EXCLUDED.grade,
           updated_at = now()",
    )
    .bind(body.household_id)
    .bind(input.kwh_monthly)
    .bind(input.ac_hours)
    .bind(input.transport.as_str())
    .bind(input.led)
    .bind(input.unplug)
    .bind(result.before.effective_kwh)
    .bind(result.before.total_co2_kg)
    .bind(result.before.cost_rp)
    .bind(&result.before.grade)
    .execute(&pool)
    .await?;

    Ok(Json(result))
}

// ── Tests ─────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn rows(pairs: &[(&str, i64)]) -> Vec<(String, i64)> {
        pairs
            .iter()
            .map(|(category, count)| ((*category).to_string(), *count))
            .collect()
    }

    fn total(distribution: &Distribution) -> i64 {
        distribution.listrik
            + distribution.transportasi
            + distribution.terbarukan
    }

    #[test]
    fn distribution_falls_back_without_joins() {
        let distribution = distribution_for(&[]);

        assert_eq!(distribution.listrik, 62);
        assert_eq!(distribution.transportasi, 25);
        assert_eq!(distribution.terbarukan, 13);
    }

    #[test]
    fn half_split_totals_exactly_100() {
        let distribution =
            distribution_for(&rows(&[("listrik", 1), ("transportasi", 7)]));

        assert_eq!(total(&distribution), 100);
        assert_eq!(distribution.terbarukan, 0);
        assert_eq!(distribution.listrik, 13);
        assert_eq!(distribution.transportasi, 87);
    }

    #[test]
    fn remainders_go_to_present_buckets_only() {
        let distribution = distribution_for(&rows(&[
            ("listrik", 5),
            ("transportasi", 2),
            ("terbarukan", 1),
        ]));

        assert_eq!(total(&distribution), 100);
        assert!(distribution.listrik > 0);
        assert!(distribution.transportasi > 0);
        assert!(distribution.terbarukan > 0);
    }

    #[test]
    fn single_category_gets_100() {
        let distribution = distribution_for(&rows(&[("terbarukan", 3)]));

        assert_eq!(total(&distribution), 100);
        assert_eq!(distribution.terbarukan, 100);
    }
}