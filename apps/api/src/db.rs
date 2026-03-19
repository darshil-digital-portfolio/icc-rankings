use anyhow::{Context, Result};
use sqlx::postgres::{PgPool, PgPoolOptions};
use tracing::info;

use crate::config::Config;

/// Establish a PostgreSQL connection pool and run migrations.
pub async fn connect(config: &Config) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .context("Failed to connect to PostgreSQL – is it running?")?;

    info!("Connected to PostgreSQL");

    // Run embedded migrations on startup.
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .context("Failed to run database migrations")?;

    info!("Migrations applied");

    Ok(pool)
}

/// Shared database handle passed through Axum's state layer.
#[derive(Clone, Debug)]
pub struct DbState {
    pub db: PgPool,
}

impl DbState {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }
}
