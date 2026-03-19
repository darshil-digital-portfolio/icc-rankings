mod data;

use anyhow::Result;
use sqlx::PgPool;
use tracing::{info, warn};


// ─── Public entry point ───────────────────────────────────────────────────────

/// Idempotent seed runner.
///
/// Checks whether the `teams` table is already populated; if so, skips
/// seeding to prevent duplicate data on container restarts.
pub async fn run(db: &PgPool) -> Result<()> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM teams")
        .fetch_one(db)
        .await?;

    if count.0 > 0 {
        info!(count = count.0, "Database already seeded – skipping");
        return Ok(());
    }

    info!("Seeding historical ICC data…");
    seed_all(db).await?;
    info!("Seeding complete");
    Ok(())
}

// ─── Core seeder ─────────────────────────────────────────────────────────────

async fn seed_all(db: &PgPool) -> Result<()> {
    insert_teams(db).await?;
    insert_events(db).await?;
    Ok(())
}

async fn insert_teams(db: &PgPool) -> Result<()> {
    let teams = data::all_teams();

    for (slug, name, short_name, flag_emoji, country_code) in &teams {
        sqlx::query(
            "INSERT INTO teams (slug, name, short_name, flag_emoji, country_code)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (slug) DO NOTHING"
        )
        .bind(slug)
        .bind(name)
        .bind(short_name)
        .bind(flag_emoji)
        .bind(country_code)
        .execute(db)
        .await?;
    }

    info!(count = teams.len(), "Teams inserted");
    Ok(())
}

async fn insert_events(db: &PgPool) -> Result<()> {
    for event_seed in data::all_events() {
        let event_type_str = serde_json::to_value(event_seed.event_type)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_default();

        // Insert event and get its generated id.
        let event_id: (i32,) = sqlx::query_as(
            "INSERT INTO events (name, short_name, event_type, year, host)
             VALUES ($1, $2, $3::event_type_enum, $4::SMALLINT, $5)
             RETURNING id"
        )
        .bind(event_seed.name)
        .bind(event_seed.short_name)
        .bind(&event_type_str)
        .bind(event_seed.year as i16)
        .bind(event_seed.host)
        .fetch_one(db)
        .await?;

        let multiplier = event_seed.event_type.multiplier();

        for (team_slug, stage) in &event_seed.results {
            let stage_str = serde_json::to_value(stage)
                .ok()
                .and_then(|v| v.as_str().map(str::to_string))
                .unwrap_or_default();

            let base_points = stage.base_points();
            // total_points is a generated column, no need to insert it

            let result = sqlx::query(
                "INSERT INTO event_results (event_id, team_slug, stage, base_points, multiplier)
                 VALUES ($1, $2, $3::stage_enum, $4::SMALLINT, $5::SMALLINT)
                 ON CONFLICT (event_id, team_slug) DO NOTHING"
            )
            .bind(event_id.0)
            .bind(team_slug)
            .bind(&stage_str)
            .bind(base_points as i16)
            .bind(multiplier as i16)
            .execute(db)
            .await;

            if let Err(e) = result {
                warn!(slug = team_slug, error = %e, "Failed to insert result – skipping");
            }
        }
    }

    let event_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM events")
        .fetch_one(db)
        .await?;
    let result_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM event_results")
        .fetch_one(db)
        .await?;

    info!(events = event_count.0, results = result_count.0, "Events and results inserted");
    Ok(())
}
