use axum::{extract::{Query, State}, Json};
use bson::{doc, Document};
use futures::TryStreamExt;
use mongodb::options::AggregateOptions;
use serde::{Deserialize, Serialize};

use crate::{db::DbState, error::AppResult, scoring::EventType};

// ─── Query params ─────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RankingsQuery {
    /// Filter by event type (optional).
    pub event_type: Option<String>,
    /// Maximum number of teams to return (default 50).
    #[serde(default = "default_limit")]
    pub limit: u32,
    /// Zero-based offset for pagination (default 0).
    #[serde(default)]
    pub offset: u32,
}

fn default_limit() -> u32 {
    50
}

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct RankingEntry {
    pub rank: u32,
    pub team_id: String,
    pub team_slug: String,
    pub team_name: String,
    pub team_short_name: String,
    pub flag_emoji: String,
    pub total_points: u32,
    pub events_participated: u32,
    pub titles: u32,
}

#[derive(Debug, Serialize)]
pub struct RankingsResponse {
    pub data: Vec<RankingEntry>,
    pub meta: RankingsMeta,
}

#[derive(Debug, Serialize)]
pub struct RankingsMeta {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/rankings`
///
/// Returns teams ordered by accumulated points descending.
/// Optionally filtered by `event_type`.
pub async fn get_rankings(
    State(state): State<DbState>,
    Query(params): Query<RankingsQuery>,
) -> AppResult<Json<RankingsResponse>> {
    let db = &state.db;

    // Build the optional event_type match stage.
    let event_type_match: Document = if let Some(ref et) = params.event_type {
        doc! { "$match": { "event_type": et } }
    } else {
        doc! { "$match": {} }
    };

    // Aggregation pipeline:
    // 1. Join events to get event_type
    // 2. Filter by event_type if provided
    // 3. Group by team_id, summing points and counting titles
    // 4. Join teams collection for metadata
    // 5. Sort by total_points descending
    let pipeline = vec![
        // Join events
        doc! {
            "$lookup": {
                "from": "events",
                "localField": "event_id",
                "foreignField": "_id",
                "as": "event"
            }
        },
        doc! { "$unwind": "$event" },
        // Optional event_type filter
        event_type_match,
        // Group by team
        doc! {
            "$group": {
                "_id": "$team_id",
                "total_points": { "$sum": "$total_points" },
                "events_participated": { "$sum": 1 },
                "titles": {
                    "$sum": {
                        "$cond": [{ "$eq": ["$stage", "champion"] }, 1, 0]
                    }
                }
            }
        },
        // Join team metadata
        doc! {
            "$lookup": {
                "from": "teams",
                "localField": "_id",
                "foreignField": "_id",
                "as": "team"
            }
        },
        doc! { "$unwind": "$team" },
        // Sort descending by points
        doc! { "$sort": { "total_points": -1 } },
        // Facet for total count + paginated data
        doc! {
            "$facet": {
                "metadata": [{ "$count": "total" }],
                "data": [
                    { "$skip": params.offset as i64 },
                    { "$limit": params.limit as i64 }
                ]
            }
        },
    ];

    let collection = db.collection::<Document>("event_results");
    let mut cursor = collection
        .aggregate(pipeline)
        .with_options(AggregateOptions::builder().allow_disk_use(true).build())
        .await?;

    let facet_doc = cursor.try_next().await?.unwrap_or_default();

    let total = facet_doc
        .get_array("metadata")
        .ok()
        .and_then(|m| m.first())
        .and_then(|m| m.as_document())
        .and_then(|m| m.get_i32("total").ok())
        .unwrap_or(0) as u32;

    let data_arr = facet_doc
        .get_array("data")
        .cloned()
        .unwrap_or_default();

    let mut entries: Vec<RankingEntry> = Vec::with_capacity(data_arr.len());
    for (i, bson_val) in data_arr.iter().enumerate() {
        let doc = match bson_val.as_document() {
            Some(d) => d,
            None => continue,
        };
        let team = doc.get_document("team").unwrap_or(&Document::new());

        let entry = RankingEntry {
            rank: params.offset + i as u32 + 1,
            team_id: doc
                .get_object_id("_id")
                .map(|oid| oid.to_hex())
                .unwrap_or_default(),
            team_slug: team.get_str("slug").unwrap_or("").to_string(),
            team_name: team.get_str("name").unwrap_or("").to_string(),
            team_short_name: team.get_str("short_name").unwrap_or("").to_string(),
            flag_emoji: team.get_str("flag_emoji").unwrap_or("").to_string(),
            total_points: doc.get_i32("total_points").unwrap_or(0) as u32,
            events_participated: doc.get_i32("events_participated").unwrap_or(0) as u32,
            titles: doc.get_i32("titles").unwrap_or(0) as u32,
        };
        entries.push(entry);
    }

    Ok(Json(RankingsResponse {
        data: entries,
        meta: RankingsMeta {
            total,
            limit: params.limit,
            offset: params.offset,
        },
    }))
}

// ─── Event-type breakdown ─────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct BreakdownEntry {
    pub event_type: String,
    pub event_type_label: String,
    pub multiplier: u32,
    pub total_points: u32,
    pub events_participated: u32,
    pub titles: u32,
}

#[derive(Debug, Serialize)]
pub struct TeamBreakdownResponse {
    pub team_slug: String,
    pub team_name: String,
    pub flag_emoji: String,
    pub grand_total: u32,
    pub breakdown: Vec<BreakdownEntry>,
}

/// `GET /api/v1/rankings/team/:slug/breakdown`
pub async fn get_team_breakdown(
    State(state): State<DbState>,
    axum::extract::Path(slug): axum::extract::Path<String>,
) -> AppResult<Json<TeamBreakdownResponse>> {
    let db = &state.db;
    let teams = db.collection::<Document>("teams");

    // Find team by slug.
    let team_doc = teams
        .find_one(doc! { "slug": &slug })
        .await?
        .ok_or_else(|| crate::error::AppError::NotFound(format!("Team '{}' not found", slug)))?;

    let team_id = team_doc.get_object_id("_id")?;
    let team_name = team_doc.get_str("name").unwrap_or("").to_string();
    let flag_emoji = team_doc.get_str("flag_emoji").unwrap_or("").to_string();

    let pipeline = vec![
        doc! { "$match": { "team_id": team_id } },
        doc! {
            "$lookup": {
                "from": "events",
                "localField": "event_id",
                "foreignField": "_id",
                "as": "event"
            }
        },
        doc! { "$unwind": "$event" },
        doc! {
            "$group": {
                "_id": "$event.event_type",
                "total_points": { "$sum": "$total_points" },
                "events_participated": { "$sum": 1 },
                "titles": {
                    "$sum": {
                        "$cond": [{ "$eq": ["$stage", "champion"] }, 1, 0]
                    }
                },
                "multiplier": { "$first": { "$toInt": 1 } }
            }
        },
        doc! { "$sort": { "total_points": -1 } },
    ];

    let collection = db.collection::<Document>("event_results");
    let mut cursor = collection.aggregate(pipeline).await?;

    let mut breakdown: Vec<BreakdownEntry> = Vec::new();
    let mut grand_total: u32 = 0;

    while let Some(doc) = cursor.try_next().await? {
        let et_str = doc.get_str("_id").unwrap_or("").to_string();
        let pts = doc.get_i32("total_points").unwrap_or(0) as u32;
        grand_total += pts;

        // Determine label and multiplier from EventType.
        let (label, mult) = event_type_meta(&et_str);

        breakdown.push(BreakdownEntry {
            event_type: et_str,
            event_type_label: label.to_string(),
            multiplier: mult,
            total_points: pts,
            events_participated: doc.get_i32("events_participated").unwrap_or(0) as u32,
            titles: doc.get_i32("titles").unwrap_or(0) as u32,
        });
    }

    Ok(Json(TeamBreakdownResponse {
        team_slug: slug,
        team_name,
        flag_emoji,
        grand_total,
        breakdown,
    }))
}

fn event_type_meta(et: &str) -> (&'static str, u32) {
    match et {
        "women_u19"               => ("Women's U19 World Cup", 1),
        "men_u19"                 => ("Men's U19 World Cup", 2),
        "women_t20_world_cup"     => ("Women's T20 World Cup", 3),
        "women_world_cup"         => ("Women's World Cup", 4),
        "men_knockout_champions"  => ("Men's Knockout / Champions Trophy", 5),
        "men_t20_world_cup"       => ("Men's T20 World Cup", 6),
        "test_championship"       => ("World Test Championship", 7),
        "men_world_cup"           => ("Men's Cricket World Cup", 8),
        _                         => ("Unknown", 0),
    }
}
