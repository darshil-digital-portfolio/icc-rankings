use anyhow::{Context, Result};
use std::env;

/// Application configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    pub mongodb_uri: String,
    pub mongodb_db: String,
    pub host: String,
    pub port: u16,
    /// Whether to seed the database with historical ICC data on first startup.
    pub seed_on_startup: bool,
}

impl Config {
    /// Load and validate configuration from the process environment.
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok(); // .env is optional (e.g. in Docker)

        Ok(Self {
            mongodb_uri: env::var("MONGODB_URI")
                .unwrap_or_else(|_| "mongodb://localhost:47017".into()),
            mongodb_db: env::var("MONGODB_DB")
                .unwrap_or_else(|_| "icc_ranking".into()),
            host: env::var("API_HOST")
                .unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("API_PORT")
                .unwrap_or_else(|_| "7429".into())
                .parse::<u16>()
                .context("API_PORT must be a valid port number")?,
            seed_on_startup: env::var("SEED_ON_STARTUP")
                .unwrap_or_else(|_| "true".into())
                .parse::<bool>()
                .unwrap_or(true),
        })
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
