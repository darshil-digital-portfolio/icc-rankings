use anyhow::{Context, Result};
use mongodb::{Client, Database, options::ClientOptions};
use tracing::info;

use crate::config::Config;

/// Establish a MongoDB connection and return the target database handle.
pub async fn connect(config: &Config) -> Result<Database> {
    let mut opts = ClientOptions::parse(&config.mongodb_uri)
        .await
        .context("Failed to parse MongoDB URI")?;

    opts.app_name = Some("icc-ranking-api".into());

    let client = Client::with_options(opts)
        .context("Failed to create MongoDB client")?;

    // Ping to verify connectivity.
    client
        .database("admin")
        .run_command(bson::doc! { "ping": 1 })
        .await
        .context("Failed to ping MongoDB – is it running?")?;

    info!(db = %config.mongodb_db, "Connected to MongoDB");

    Ok(client.database(&config.mongodb_db))
}

/// Shared database handle passed through Axum's extension layer.
#[derive(Clone, Debug)]
pub struct DbState {
    pub db: Database,
}

impl DbState {
    pub fn new(db: Database) -> Self {
        Self { db }
    }
}
