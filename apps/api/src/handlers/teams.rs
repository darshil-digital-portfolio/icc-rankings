use axum::{
    extract::{Path, Query, State},
    Json,
};
use bson::{doc, Document};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

use crate::{db::DbState, error::{AppError, AppResult}};

// ─── Query ────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TeamsQuery {
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
    /// Optional free-text search on team name.
    pub q: Option<String>,
}

fn default_limit() -> u32 {
    100
}

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TeamSummary {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub short_name: String,
    pub flag_emoji: String,
    pub country_code: String,
    pub total_points: u32,
    pub events_participated: u32,
    pub titles: u32,
    pub rank: u32,
}

#[derive(Debug, Serialize)]
pub struct TeamsResponse {
    pub data: Vec<TeamSummary>,
    pub meta: TeamsMeta,
}

#[derive(Debug, Serialize)]
pub struct TeamsMeta {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/teams`
pub async fn list_teams(
    State(state): State<DbState>,
    Query(params): Query<TeamsQuery>,
) -> AppResult<Json<TeamsResponse>> {
    let db = &state.db;

    let mut match_stage = doc! {};
    if let Some(ref q) = params.q {
        match_stage.insert("name", doc! { "$regex": q, "$options": "i" });
    }

    let pipeline = vec![
        // Aggregate points from results
        doc! {
            "$lookup": {
                "from": "event_results",
                "localField": "_id",
                "foreignField": "team_id",
                "as": "results"
            }
        },
        doc! {
            "$addFields": {
                "total_points": { "$sum": "$results.total_points" },
                "events_participated": { "$size": "$results" },
                "titles": {
                    "$size": {
                        "$filter": {
                            "input": "$results",
                            "as": "r",
                            "cond": { "$eq": ["$$r.stage", "champion"] }
                        }
                    }
                }
            }
        },
        doc! { "$match": match_stage },
        doc! { "$sort": { "total_points": -1 } },
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

    let collection = db.collection::<Document>("teams");
    let mut cursor = collection.aggregate(pipeline).await?;
    let facet_doc = cursor.try_next().await?.unwrap_or_default();

    let total = facet_doc
        .get_array("metadata")
        .ok()
        .and_then(|m| m.first())
        .and_then(|v| v.as_document())
        .and_then(|d| d.get_i32("total").ok())
        .unwrap_or(0) as u32;

    let data_arr = facet_doc.get_array("data").cloned().unwrap_or_default();
    let mut summaries = Vec::with_capacity(data_arr.len());

    for (i, val) in data_arr.iter().enumerate() {
        let d = match val.as_document() {
            Some(d) => d,
            None => continue,
        };
        summaries.push(TeamSummary {
            id: d.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default(),
            slug: d.get_str("slug").unwrap_or("").to_string(),
            name: d.get_str("name").unwrap_or("").to_string(),
            short_name: d.get_str("short_name").unwrap_or("").to_string(),
            flag_emoji: d.get_str("flag_emoji").unwrap_or("").to_string(),
            country_code: d.get_str("country_code").unwrap_or("").to_string(),
            total_points: d.get_i32("total_points").unwrap_or(0) as u32,
            events_participated: d.get_i32("events_participated").unwrap_or(0) as u32,
            titles: d.get_i32("titles").unwrap_or(0) as u32,
            rank: params.offset + i as u32 + 1,
        });
    }

    Ok(Json(TeamsResponse {
        data: summaries,
        meta: TeamsMeta { total, limit: params.limit, offset: params.offset },
    }))
}

// ─── Team detail ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct EventHistoryEntry {
    pub event_id: String,
    pub event_name: String,
    pub event_short_name: String,
    pub event_type: String,
    pub event_type_label: String,
    pub year: i32,
    pub host: String,
    pub stage: String,
    pub stage_label: String,
    pub base_points: u32,
    pub multiplier: u32,
    pub total_points: u32,
}

#[derive(Debug, Serialize)]
pub struct TeamDetailResponse {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub short_name: String,
    pub flag_emoji: String,
    pub country_code: String,
    pub total_points: u32,
    pub events_participated: u32,
    pub titles: u32,
    pub history: Vec<EventHistoryEntry>,
}

/// `GET /api/v1/teams/:slug`
pub async fn get_team(
    State(state): State<DbState>,
    Path(slug): Path<String>,
) -> AppResult<Json<TeamDetailResponse>> {
    let db = &state.db;
    let teams = db.collection::<Document>("teams");

    let team_doc = teams
        .find_one(doc! { "slug": &slug })
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Team '{}' not found", slug)))?;

    let team_id = team_doc.get_object_id("_id")?;

    // Fetch all event results for this team, joined with events.
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
        doc! { "$sort": { "event.year": 1 } },
    ];

    let results_col = db.collection::<Document>("event_results");
    let mut cursor = results_col.aggregate(pipeline).await?;

    let mut history: Vec<EventHistoryEntry> = Vec::new();
    let mut total_points: u32 = 0;
    let mut titles: u32 = 0;

    while let Some(res) = cursor.try_next().await? {
        let event = res.get_document("event").unwrap_or(&Document::new()).clone();
        let pts = res.get_i32("total_points").unwrap_or(0) as u32;
        let stage_str = res.get_str("stage").unwrap_or("").to_string();
        let et_str = event.get_str("event_type").unwrap_or("").to_string();

        total_points += pts;
        if stage_str == "champion" {
            titles += 1;
        }

        history.push(EventHistoryEntry {
            event_id: event.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default(),
            event_name: event.get_str("name").unwrap_or("").to_string(),
            event_short_name: event.get_str("short_name").unwrap_or("").to_string(),
            event_type_label: event_type_label(&et_str).to_string(),
            event_type: et_str,
            year: event.get_i32("year").unwrap_or(0),
            host: event.get_str("host").unwrap_or("").to_string(),
            stage_label: stage_label(&stage_str).to_string(),
            stage: stage_str,
            base_points: res.get_i32("base_points").unwrap_or(0) as u32,
            multiplier: res.get_i32("multiplier").unwrap_or(0) as u32,
            total_points: pts,
        });
    }

    Ok(Json(TeamDetailResponse {
        id: team_id.to_hex(),
        slug: team_doc.get_str("slug").unwrap_or("").to_string(),
        name: team_doc.get_str("name").unwrap_or("").to_string(),
        short_name: team_doc.get_str("short_name").unwrap_or("").to_string(),
        flag_emoji: team_doc.get_str("flag_emoji").unwrap_or("").to_string(),
        country_code: team_doc.get_str("country_code").unwrap_or("").to_string(),
        events_participated: history.len() as u32,
        titles,
        total_points,
        history,
    }))
}

fn event_type_label(et: &str) -> &'static str {
    match et {
        "women_u19"               => "Women's U19 World Cup",
        "men_u19"                 => "Men's U19 World Cup",
        "women_t20_world_cup"     => "Women's T20 World Cup",
        "women_world_cup"         => "Women's World Cup",
        "men_knockout_champions"  => "Men's Knockout / Champions Trophy",
        "men_t20_world_cup"       => "Men's T20 World Cup",
        "test_championship"       => "World Test Championship",
        "men_world_cup"           => "Men's Cricket World Cup",
        _                         => "Unknown",
    }
}

fn stage_label(stage: &str) -> &'static str {
    match stage {
        "first_stage"   => "Group Stage",
        "other_stage"   => "Quarter-Final / Super Stage",
        "semi_final"    => "Semi-Final",
        "final"         => "Runner-Up",
        "champion"      => "Champion",
        _               => "Unknown",
    }
}
