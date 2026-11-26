use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{rejection::JsonRejection, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::api::{json_body, ApiError};

const SESSION_COOKIE: &str = "sdg12_session";
const SESSION_DAYS: i64 = 14;
const MAX_FAILED_ATTEMPTS: i64 = 8;
const ATTEMPT_WINDOW_MINUTES: i64 = 15;

pub fn routes() -> Router<PgPool> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
}

#[derive(Clone, Debug, Serialize, FromRow)]
pub struct AuthUser {
    pub id: Uuid,
    pub household_id: Uuid,
    pub email: String,
    pub display_name: Option<String>,
}

impl AuthUser {
    fn into_response_json(self) -> Json<AuthUser> {
        Json(self)
    }
}

fn hash_password(password: &str) -> Result<String, ApiError> {
    // 16 random bytes from a v4 UUID make a per-password salt; no extra RNG dep.
    let salt_bytes = Uuid::new_v4().into_bytes();
    let salt = SaltString::encode_b64(&salt_bytes)
        .map_err(|_| ApiError::Internal(anyhow_message("salt encoding")))?;
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| ApiError::Internal(anyhow_message("password hashing")))
}

fn verify_password(password: &str, stored: &str) -> bool {
    PasswordHash::new(stored)
        .map(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false)
}

fn hash_token(token: &str) -> String {
    let digest = Sha256::digest(token.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn new_session_token() -> String {
    format!(
        "{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    )
}

fn cookie_value(headers: &HeaderMap) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    raw.split(';')
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| *name == SESSION_COOKIE)
        .map(|(_, value)| value.to_string())
}

fn session_cookie(token: &str, max_age_seconds: i64) -> HeaderValue {
    let secure = if std::env::var("COOKIE_SECURE").as_deref() == Ok("1") {
        "; Secure"
    } else {
        ""
    };
    HeaderValue::from_str(&format!(
        "{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age_seconds}{secure}"
    ))
    .expect("session cookie is ASCII")
}

fn set_cookie_response(user: AuthUser, token: &str) -> Response {
    let cookie = session_cookie(token, SESSION_DAYS * 86_400);
    ([(header::SET_COOKIE, cookie)], user.into_response_json()).into_response()
}

/// Resolve the session cookie to a user. Missing/expired/unknown sessions are
/// simply `None`; callers decide whether anonymous access is allowed.
pub async fn user_from_headers(
    pool: &PgPool,
    headers: &HeaderMap,
) -> Result<Option<AuthUser>, sqlx::Error> {
    let Some(token) = cookie_value(headers) else {
        return Ok(None);
    };
    let token_hash = hash_token(&token);
    sqlx::query_as::<_, AuthUser>(
        "SELECT u.id, u.household_id, u.email, h.display_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN households h ON h.id = u.household_id
         WHERE s.token_hash = $1 AND s.expires_at > now()",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
}

async fn create_session(pool: &PgPool, user_id: Uuid) -> Result<String, ApiError> {
    let token = new_session_token();
    sqlx::query("DELETE FROM sessions WHERE expires_at < now()")
        .execute(pool)
        .await?;
    sqlx::query(
        "INSERT INTO sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    )
    .bind(hash_token(&token))
    .bind(user_id)
    .bind(SESSION_DAYS.to_string())
    .execute(pool)
    .await?;
    Ok(token)
}

fn clean_email(raw: &str) -> Result<String, ApiError> {
    let email = raw.trim().to_lowercase();
    let invalid = || ApiError::BadRequest("email tidak valid".into());
    let (local, domain) = email.split_once('@').ok_or_else(invalid)?;
    if email.len() > 254
        || local.is_empty()
        || local.len() > 64
        || domain.starts_with('.')
        || domain.ends_with('.')
        || !domain.contains('.')
        || email.chars().any(char::is_whitespace)
    {
        return Err(invalid());
    }
    Ok(email)
}

fn clean_password(raw: &str) -> Result<&str, ApiError> {
    let length = raw.chars().count();
    if !(8..=128).contains(&length) {
        return Err(ApiError::BadRequest(
            "kata sandi harus 8-128 karakter".into(),
        ));
    }
    Ok(raw)
}

fn clean_name(raw: &str) -> Result<String, ApiError> {
    let name = raw.trim();
    let length = name.chars().count();
    if !(2..=60).contains(&length) {
        return Err(ApiError::BadRequest("nama harus 2-60 karakter".into()));
    }
    Ok(name.to_string())
}

#[derive(Deserialize)]
struct RegisterBody {
    email: String,
    password: String,
    display_name: String,
}

async fn register(
    State(pool): State<PgPool>,
    payload: Result<Json<RegisterBody>, JsonRejection>,
) -> Result<Response, ApiError> {
    let body = json_body(payload)?;
    let email = clean_email(&body.email)?;
    let password = clean_password(&body.password)?;
    let name = clean_name(&body.display_name)?;
    let password_hash = hash_password(password)?;

    let mut tx = pool.begin().await?;
    let household_id = Uuid::new_v4();
    sqlx::query("INSERT INTO households (id, display_name) VALUES ($1, $2)")
        .bind(household_id)
        .bind(&name)
        .execute(&mut *tx)
        .await?;

    let user_id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO users (household_id, email, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT ((lower(email))) DO NOTHING
         RETURNING id",
    )
    .bind(household_id)
    .bind(&email)
    .bind(&password_hash)
    .fetch_optional(&mut *tx)
    .await?;

    let Some(user_id) = user_id else {
        // Roll back the household we just made for the losing duplicate.
        tx.rollback().await?;
        return Err(ApiError::Conflict("email sudah terdaftar".into()));
    };
    tx.commit().await?;

    let token = create_session(&pool, user_id).await?;
    Ok(set_cookie_response(
        AuthUser {
            id: user_id,
            household_id,
            email,
            display_name: Some(name),
        },
        &token,
    ))
}

#[derive(Deserialize)]
struct LoginBody {
    email: String,
    password: String,
}

async fn record_attempt(pool: &PgPool, email: &str, success: bool) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO auth_attempts (email, success) VALUES ($1, $2)")
        .bind(email)
        .bind(success)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM auth_attempts WHERE attempted_at < now() - interval '1 day'")
        .execute(pool)
        .await?;
    Ok(())
}

async fn too_many_failures(pool: &PgPool, email: &str) -> Result<bool, ApiError> {
    let failed: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM auth_attempts
         WHERE lower(email) = lower($1) AND NOT success
           AND attempted_at > now() - ($2 || ' minutes')::interval",
    )
    .bind(email)
    .bind(ATTEMPT_WINDOW_MINUTES.to_string())
    .fetch_one(pool)
    .await?;
    Ok(failed >= MAX_FAILED_ATTEMPTS)
}

async fn login(
    State(pool): State<PgPool>,
    payload: Result<Json<LoginBody>, JsonRejection>,
) -> Result<Response, ApiError> {
    let body = json_body(payload)?;
    let email = clean_email(&body.email)?;
    if body.password.is_empty() || body.password.chars().count() > 128 {
        return Err(ApiError::BadRequest("kata sandi tidak valid".into()));
    }

    // ponytail: per-email lockout only; add per-IP once a trusted proxy header
    // exists (X-Forwarded-For is spoofable without one).
    if too_many_failures(&pool, &email).await? {
        return Err(ApiError::TooManyRequests(
            "terlalu banyak percobaan gagal, coba lagi nanti".into(),
        ));
    }

    #[derive(FromRow)]
    struct StoredUser {
        id: Uuid,
        household_id: Uuid,
        email: String,
        password_hash: String,
        display_name: Option<String>,
    }

    let stored = sqlx::query_as::<_, StoredUser>(
        "SELECT u.id, u.household_id, u.email, u.password_hash, h.display_name
         FROM users u JOIN households h ON h.id = u.household_id
         WHERE lower(u.email) = lower($1)",
    )
    .bind(&email)
    .fetch_optional(&pool)
    .await?;

    let Some(stored) = stored else {
        // Burn comparable CPU so unknown emails do not answer faster.
        let _ = hash_password(&body.password);
        record_attempt(&pool, &email, false).await?;
        return Err(ApiError::Unauthorized("email atau kata sandi salah".into()));
    };

    if !verify_password(&body.password, &stored.password_hash) {
        record_attempt(&pool, &email, false).await?;
        return Err(ApiError::Unauthorized("email atau kata sandi salah".into()));
    }

    record_attempt(&pool, &email, true).await?;
    let token = create_session(&pool, stored.id).await?;
    Ok(set_cookie_response(
        AuthUser {
            id: stored.id,
            household_id: stored.household_id,
            email: stored.email,
            display_name: stored.display_name,
        },
        &token,
    ))
}

async fn logout(State(pool): State<PgPool>, headers: HeaderMap) -> Result<Response, ApiError> {
    if let Some(token) = cookie_value(&headers) {
        sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
            .bind(hash_token(&token))
            .execute(&pool)
            .await?;
    }
    let cleared = session_cookie("", 0);
    Ok((
        StatusCode::NO_CONTENT,
        [(header::SET_COOKIE, cleared)],
    )
        .into_response())
}

async fn me(State(pool): State<PgPool>, headers: HeaderMap) -> Result<Json<AuthUser>, ApiError> {
    match user_from_headers(&pool, &headers).await? {
        Some(user) => Ok(Json(user)),
        None => Err(ApiError::Unauthorized("belum masuk".into())),
    }
}

/// Placeholder error for crypto failures that should never reach users.
fn anyhow_message(context: &str) -> sqlx::Error {
    sqlx::Error::Protocol(format!("{context} failed"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_validation_accepts_common_addresses() {
        assert_eq!(clean_email("  Budi@Example.COM ").unwrap(), "budi@example.com");
        assert!(clean_email("no-at-sign").is_err());
        assert!(clean_email("user@localhost").is_err());
        assert!(clean_email("user@.com").is_err());
        assert!(clean_email("a b@example.com").is_err());
    }

    #[test]
    fn password_hash_roundtrips_and_rejects_wrong_password() {
        let hash = hash_password("rahasia123").unwrap();
        assert!(verify_password("rahasia123", &hash));
        assert!(!verify_password("rahasia124", &hash));
        assert!(!verify_password("rahasia123", "not-a-phc-string"));
    }

    #[test]
    fn session_tokens_are_unique_and_hashed() {
        let a = new_session_token();
        let b = new_session_token();
        assert_ne!(a, b);
        assert_eq!(a.len(), 64);
        assert_eq!(hash_token(&a).len(), 64);
        assert_ne!(hash_token(&a), a);
    }

    #[test]
    fn password_length_bounds() {
        assert!(clean_password("1234567").is_err());
        assert!(clean_password("12345678").is_ok());
        assert!(clean_password(&"x".repeat(129)).is_err());
    }
}
