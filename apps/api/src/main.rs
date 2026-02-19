mod config;
mod db;
mod error;
mod handlers;
mod models;
mod routes;
mod scoring;
mod seed;

use anyhow::Result;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // ── Logging ──────────────────────────────────────────────────────────────
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .compact()
        .init();

    // ── Config ───────────────────────────────────────────────────────────────
    let config = config::Config::from_env()?;
    info!(bind = %config.bind_addr(), "Starting ICC Ranking API");

    // ── Database ─────────────────────────────────────────────────────────────
    let database = db::connect(&config).await?;
    let state = db::DbState::new(database);

    // ── Seed ─────────────────────────────────────────────────────────────────
    if config.seed_on_startup {
        seed::run(&state.db).await?;
    }

    // ── Router ───────────────────────────────────────────────────────────────
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::build_router(state)
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors);

    // ── Serve ────────────────────────────────────────────────────────────────
    let listener = tokio::net::TcpListener::bind(config.bind_addr()).await?;
    info!(addr = %listener.local_addr()?, "Listening");
    axum::serve(listener, app).await?;

    Ok(())
}
