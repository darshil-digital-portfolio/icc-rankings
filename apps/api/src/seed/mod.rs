mod data;

use anyhow::Result;
use bson::{doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::Database;
use std::collections::HashMap;
use tracing::{info, warn};

use crate::{
    models::{event::COLLECTION as EVENTS_COL, result::COLLECTION as RESULTS_COL, team::COLLECTION as TEAMS_COL},
    scoring::{calculate_points, EventType, Stage},
};

// ─── Public entry point ───────────────────────────────────────────────────────

/// Idempotent seed runner.
///
/// Checks whether the `teams` collection is already populated; if so, skips
/// seeding to prevent duplicate data on container restarts.
pub async fn run(db: &Database) -> Result<()> {
    let teams_col = db.collection::<bson::Document>(TEAMS_COL);

    let existing_count = teams_col.count_documents(doc! {}).await?;
    if existing_count > 0 {
        info!(count = existing_count, "Database already seeded – skipping");
        return Ok(());
    }

    info!("Seeding historical ICC data…");
    seed_all(db).await?;
    info!("Seeding complete");
    Ok(())
}

// ─── Core seeder ─────────────────────────────────────────────────────────────

async fn seed_all(db: &Database) -> Result<()> {
    // 1. Insert all teams and build a slug → ObjectId map.
    let team_ids = insert_teams(db).await?;

    // 2. Insert all events and results.
    insert_events(db, &team_ids).await?;

    // 3. Create indexes for query performance.
    create_indexes(db).await?;

    Ok(())
}

async fn insert_teams(db: &Database) -> Result<HashMap<String, ObjectId>> {
    let col = db.collection::<bson::Document>(TEAMS_COL);
    let teams = data::all_teams();

    let docs: Vec<bson::Document> = teams
        .iter()
        .map(|(slug, name, short, flag, cc)| {
            doc! {
                "slug":         slug,
                "name":         name,
                "short_name":   short,
                "flag_emoji":   flag,
                "country_code": cc,
                "created_at":   bson::DateTime::from_chrono(Utc::now()),
            }
        })
        .collect();

    let result = col.insert_many(docs).await?;
    info!(count = result.inserted_ids.len(), "Teams inserted");

    // Re-query to get _id for each slug.
    let mut map: HashMap<String, ObjectId> = HashMap::new();
    let mut cursor = col.find(doc! {}).await?;
    while let Some(doc) = cursor.try_next().await? {
        if let (Ok(slug), Ok(oid)) = (
            doc.get_str("slug").map(str::to_string),
            doc.get_object_id("_id"),
        ) {
            map.insert(slug, oid);
        }
    }

    Ok(map)
}

async fn insert_events(
    db: &Database,
    team_ids: &HashMap<String, ObjectId>,
) -> Result<()> {
    let events_col = db.collection::<bson::Document>(EVENTS_COL);
    let results_col = db.collection::<bson::Document>(RESULTS_COL);

    for event_seed in data::all_events() {
        // Insert event document.
        let event_doc = doc! {
            "name":       &event_seed.name,
            "short_name": &event_seed.short_name,
            "event_type": serde_json::to_value(&event_seed.event_type)
                .ok()
                .and_then(|v| v.as_str().map(str::to_string))
                .unwrap_or_default(),
            "year":       event_seed.year,
            "host":       &event_seed.host,
            "created_at": bson::DateTime::from_chrono(Utc::now()),
        };

        let insert_result = events_col.insert_one(event_doc).await?;
        let event_id = insert_result
            .inserted_id
            .as_object_id()
            .expect("inserted_id must be ObjectId");

        let multiplier = event_seed.event_type.multiplier();

        // Insert one result document per participant.
        let mut result_docs: Vec<bson::Document> = Vec::new();
        for (team_slug, stage) in &event_seed.results {
            let team_id = match team_ids.get(*team_slug) {
                Some(id) => *id,
                None => {
                    warn!(slug = team_slug, "Team slug not found in map – skipping");
                    continue;
                }
            };

            let base_points = stage.base_points();
            let total_points = calculate_points(*stage, event_seed.event_type);

            result_docs.push(doc! {
                "event_id":    event_id,
                "team_id":     team_id,
                "stage":       serde_json::to_value(stage)
                    .ok()
                    .and_then(|v| v.as_str().map(str::to_string))
                    .unwrap_or_default(),
                "base_points":  base_points as i32,
                "multiplier":   multiplier as i32,
                "total_points": total_points as i32,
                "created_at":   bson::DateTime::from_chrono(Utc::now()),
            });
        }

        if !result_docs.is_empty() {
            results_col.insert_many(result_docs).await?;
        }
    }

    Ok(())
}

async fn create_indexes(db: &Database) -> Result<()> {
    use mongodb::IndexModel;
    use bson::doc;

    // teams.slug – unique lookup
    db.collection::<bson::Document>(TEAMS_COL)
        .create_index(IndexModel::builder().keys(doc! { "slug": 1 }).build())
        .await?;

    // events – common filter patterns
    db.collection::<bson::Document>(EVENTS_COL)
        .create_index(IndexModel::builder().keys(doc! { "event_type": 1, "year": -1 }).build())
        .await?;

    // event_results – foreign-key lookups and aggregation
    let results = db.collection::<bson::Document>(RESULTS_COL);
    results
        .create_index(IndexModel::builder().keys(doc! { "event_id": 1 }).build())
        .await?;
    results
        .create_index(IndexModel::builder().keys(doc! { "team_id": 1 }).build())
        .await?;
    results
        .create_index(
            IndexModel::builder()
                .keys(doc! { "team_id": 1, "event_id": 1 })
                .build(),
        )
        .await?;

    info!("Indexes created");
    Ok(())
}
