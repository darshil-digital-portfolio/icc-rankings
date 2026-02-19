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
pub struct EventsQuery {
    pub event_type: Option<String>,
    pub year: Option<i32>,
    #[serde(default = "default_limit")]
    pub limit: u32,
    #[serde(default)]
    pub offset: u32,
}

fn default_limit() -> u32 {
    100
}

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct EventSummary {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub event_type: String,
    pub event_type_label: String,
    pub multiplier: u32,
    pub year: i32,
    pub host: String,
    pub teams_count: u32,
    pub champion_slug: Option<String>,
    pub champion_name: Option<String>,
    pub champion_flag: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EventsResponse {
    pub data: Vec<EventSummary>,
    pub meta: EventsMeta,
}

#[derive(Debug, Serialize)]
pub struct EventsMeta {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/events`
pub async fn list_events(
    State(state): State<DbState>,
    Query(params): Query<EventsQuery>,
) -> AppResult<Json<EventsResponse>> {
    let db = &state.db;

    let mut match_filter = doc! {};
    if let Some(ref et) = params.event_type {
        match_filter.insert("event_type", et.clone());
    }
    if let Some(yr) = params.year {
        match_filter.insert("year", yr);
    }

    let pipeline = vec![
        doc! { "$match": match_filter },
        doc! { "$sort": { "year": -1 } },
        doc! {
            "$lookup": {
                "from": "event_results",
                "localField": "_id",
                "foreignField": "event_id",
                "as": "results"
            }
        },
        // Find the champion result
        doc! {
            "$addFields": {
                "teams_count": { "$size": "$results" },
                "champion_result": {
                    "$arrayElemAt": [
                        {
                            "$filter": {
                                "input": "$results",
                                "as": "r",
                                "cond": { "$eq": ["$$r.stage", "champion"] }
                            }
                        },
                        0
                    ]
                }
            }
        },
        // Join champion's team info
        doc! {
            "$lookup": {
                "from": "teams",
                "localField": "champion_result.team_id",
                "foreignField": "_id",
                "as": "champion_team"
            }
        },
        doc! {
            "$addFields": {
                "champion_team": { "$arrayElemAt": ["$champion_team", 0] }
            }
        },
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

    let collection = db.collection::<Document>("events");
    let mut cursor = collection.aggregate(pipeline).await?;
    let facet = cursor.try_next().await?.unwrap_or_default();

    let total = facet
        .get_array("metadata").ok()
        .and_then(|m| m.first()).and_then(|v| v.as_document())
        .and_then(|d| d.get_i32("total").ok())
        .unwrap_or(0) as u32;

    let data_arr = facet.get_array("data").cloned().unwrap_or_default();
    let mut summaries = Vec::with_capacity(data_arr.len());

    for val in &data_arr {
        let d = match val.as_document() {
            Some(d) => d,
            None => continue,
        };
        let et_str = d.get_str("event_type").unwrap_or("").to_string();
        let (label, mult) = event_type_meta(&et_str);
        let champ = d.get_document("champion_team").ok();

        summaries.push(EventSummary {
            id: d.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default(),
            name: d.get_str("name").unwrap_or("").to_string(),
            short_name: d.get_str("short_name").unwrap_or("").to_string(),
            event_type_label: label.to_string(),
            event_type: et_str,
            multiplier: mult,
            year: d.get_i32("year").unwrap_or(0),
            host: d.get_str("host").unwrap_or("").to_string(),
            teams_count: d.get_i32("teams_count").unwrap_or(0) as u32,
            champion_slug: champ.and_then(|c| c.get_str("slug").ok()).map(str::to_string),
            champion_name: champ.and_then(|c| c.get_str("name").ok()).map(str::to_string),
            champion_flag: champ.and_then(|c| c.get_str("flag_emoji").ok()).map(str::to_string),
        });
    }

    Ok(Json(EventsResponse {
        data: summaries,
        meta: EventsMeta { total, limit: params.limit, offset: params.offset },
    }))
}

// ─── Event detail ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ParticipantEntry {
    pub team_id: String,
    pub team_slug: String,
    pub team_name: String,
    pub team_short_name: String,
    pub flag_emoji: String,
    pub stage: String,
    pub stage_label: String,
    pub base_points: u32,
    pub multiplier: u32,
    pub total_points: u32,
}

#[derive(Debug, Serialize)]
pub struct EventDetailResponse {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub event_type: String,
    pub event_type_label: String,
    pub multiplier: u32,
    pub year: i32,
    pub host: String,
    pub participants: Vec<ParticipantEntry>,
}

/// `GET /api/v1/events/:id`
pub async fn get_event(
    State(state): State<DbState>,
    Path(id): Path<String>,
) -> AppResult<Json<EventDetailResponse>> {
    let db = &state.db;
    let events_col = db.collection::<Document>("events");

    let oid = bson::oid::ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest(format!("'{}' is not a valid event ID", id)))?;

    let event_doc = events_col
        .find_one(doc! { "_id": oid })
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Event '{}' not found", id)))?;

    let et_str = event_doc.get_str("event_type").unwrap_or("").to_string();
    let (label, mult) = event_type_meta(&et_str);

    // Fetch results joined with teams, sorted by total_points descending.
    let pipeline = vec![
        doc! { "$match": { "event_id": oid } },
        doc! {
            "$lookup": {
                "from": "teams",
                "localField": "team_id",
                "foreignField": "_id",
                "as": "team"
            }
        },
        doc! { "$unwind": "$team" },
        doc! { "$sort": { "total_points": -1 } },
    ];

    let results_col = db.collection::<Document>("event_results");
    let mut cursor = results_col.aggregate(pipeline).await?;
    let mut participants: Vec<ParticipantEntry> = Vec::new();

    while let Some(res) = cursor.try_next().await? {
        let team = res.get_document("team").unwrap_or(&Document::new()).clone();
        let stage_str = res.get_str("stage").unwrap_or("").to_string();

        participants.push(ParticipantEntry {
            team_id: team.get_object_id("_id").map(|o| o.to_hex()).unwrap_or_default(),
            team_slug: team.get_str("slug").unwrap_or("").to_string(),
            team_name: team.get_str("name").unwrap_or("").to_string(),
            team_short_name: team.get_str("short_name").unwrap_or("").to_string(),
            flag_emoji: team.get_str("flag_emoji").unwrap_or("").to_string(),
            stage_label: stage_label(&stage_str).to_string(),
            stage: stage_str,
            base_points: res.get_i32("base_points").unwrap_or(0) as u32,
            multiplier: res.get_i32("multiplier").unwrap_or(0) as u32,
            total_points: res.get_i32("total_points").unwrap_or(0) as u32,
        });
    }

    Ok(Json(EventDetailResponse {
        id,
        name: event_doc.get_str("name").unwrap_or("").to_string(),
        short_name: event_doc.get_str("short_name").unwrap_or("").to_string(),
        event_type_label: label.to_string(),
        event_type: et_str,
        multiplier: mult,
        year: event_doc.get_i32("year").unwrap_or(0),
        host: event_doc.get_str("host").unwrap_or("").to_string(),
        participants,
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
