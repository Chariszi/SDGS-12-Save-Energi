mod api;
mod auth;
mod calc;
mod mail;

use axum::{http::StatusCode, Router};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // A malformed .env line aborts parsing at that line; surface it instead of
    // silently running with half the configuration (e.g. no SMTP_PASSWORD).
    if let Err(error) = dotenvy::dotenv() {
        if !matches!(error, dotenvy::Error::Io(_)) {
            eprintln!("warning: could not load .env: {error}");
        }
    }

    let database_url = std::env::var("DATABASE_URL")?;
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let frontend = concat!(env!("CARGO_MANIFEST_DIR"), "/..");
    let app = Router::new()
        .nest("/api", api::router(pool))
        .route_service("/", ServeFile::new(format!("{frontend}/index.html")))
        .route_service("/index.html", ServeFile::new(format!("{frontend}/index.html")))
        .route_service("/login", ServeFile::new(format!("{frontend}/login.html")))
        .route_service("/login.html", ServeFile::new(format!("{frontend}/login.html")))
        .route_service(
            "/calculator.html",
            ServeFile::new(format!("{frontend}/calculator.html")),
        )
        .nest_service("/js", ServeDir::new(format!("{frontend}/js")))
        .fallback(|| async { (StatusCode::NOT_FOUND, "Not found") });

    let addr: SocketAddr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:8080".to_string())
        .parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    eprintln!("SDG 12 Energi running on http://{addr}");
    axum::serve(listener, app).await?;

    Ok(())
}
