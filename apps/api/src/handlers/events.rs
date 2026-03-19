use axum::{
    extract::{Path, Query, State},
    Json,
};
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

// ─── Row types ────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct EventListRow {
    id: i32,
    name: String,
    short_name: String,
    event_type: String,
    year: i16,
    host: String,
    teams_count: Option<i64>,
    champion_slug: Option<String>,
    champion_name: Option<String>,
    champion_flag: Option<String>,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/events`
pub async fn list_events(
    State(state): State<DbState>,
    Query(params): Query<EventsQuery>,
) -> AppResult<Json<EventsResponse>> {
    let pool = &state.db;

    let rows = sqlx::query_as::<_, EventListRow>(
        "SELECT e.id, e.name, e.short_name, e.event_type::TEXT, e.year, e.host,
                COUNT(er.id)::BIGINT AS teams_count,
                champ.team_slug   AS champion_slug,
                t.name            AS champion_name,
                t.flag_emoji      AS champion_flag
         FROM events e
         LEFT JOIN event_results er    ON er.event_id = e.id
         LEFT JOIN event_results champ ON champ.event_id = e.id AND champ.stage = 'champion'
         LEFT JOIN teams t             ON t.slug = champ.team_slug
         WHERE ($1::TEXT IS NULL OR e.event_type::TEXT = $1)
           AND ($2::INT IS NULL OR e.year = $2::SMALLINT)
         GROUP BY e.id, e.name, e.short_name, e.event_type, e.year, e.host,
                  champ.team_slug, t.name, t.flag_emoji
         ORDER BY e.year DESC
         LIMIT $3 OFFSET $4"
    )
    .bind(&params.event_type)
    .bind(params.year)
    .bind(params.limit as i64)
    .bind(params.offset as i64)
    .fetch_all(pool)
    .await?;

    let total_row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::BIGINT FROM events e
         WHERE ($1::TEXT IS NULL OR e.event_type::TEXT = $1)
           AND ($2::INT IS NULL OR e.year = $2::SMALLINT)"
    )
    .bind(&params.event_type)
    .bind(params.year)
    .fetch_one(pool)
    .await?;

    let summaries: Vec<EventSummary> = rows
        .iter()
        .map(|r| {
            let (label, mult) = event_type_meta(&r.event_type);
            EventSummary {
                id: r.id.to_string(),
                name: r.name.clone(),
                short_name: r.short_name.clone(),
                event_type_label: label.to_string(),
                event_type: r.event_type.clone(),
                multiplier: mult,
                year: r.year as i32,
                host: r.host.clone(),
                teams_count: r.teams_count.unwrap_or(0) as u32,
                champion_slug: r.champion_slug.clone(),
                champion_name: r.champion_name.clone(),
                champion_flag: r.champion_flag.clone(),
            }
        })
        .collect();

    Ok(Json(EventsResponse {
        data: summaries,
        meta: EventsMeta {
            total: total_row.0 as u32,
            limit: params.limit,
            offset: params.offset,
        },
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

#[derive(sqlx::FromRow)]
struct ParticipantRow {
    team_slug: String,
    team_name: String,
    team_short_name: String,
    flag_emoji: String,
    stage: String,
    base_points: i16,
    multiplier: i16,
    total_points: i16,
}

/// `GET /api/v1/events/:id`
pub async fn get_event(
    State(state): State<DbState>,
    Path(id): Path<String>,
) -> AppResult<Json<EventDetailResponse>> {
    let pool = &state.db;

    let event_id: i32 = id
        .parse()
        .map_err(|_| AppError::BadRequest(format!("'{}' is not a valid event ID", id)))?;

    // Fetch event
    let event = sqlx::query_as::<_, crate::models::Event>(
        "SELECT id, name, short_name, event_type::TEXT, year, host FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Event '{}' not found", id)))?;

    let (label, mult) = event_type_meta(&event.event_type);

    // Fetch participants
    let rows = sqlx::query_as::<_, ParticipantRow>(
        "SELECT er.team_slug, t.name AS team_name, t.short_name AS team_short_name,
                t.flag_emoji, er.stage::TEXT, er.base_points, er.multiplier, er.total_points
         FROM event_results er
         JOIN teams t ON t.slug = er.team_slug
         WHERE er.event_id = $1
         ORDER BY er.total_points DESC"
    )
    .bind(event_id)
    .fetch_all(pool)
    .await?;

    let participants: Vec<ParticipantEntry> = rows
        .iter()
        .map(|r| ParticipantEntry {
            team_id: r.team_slug.clone(),
            team_slug: r.team_slug.clone(),
            team_name: r.team_name.clone(),
            team_short_name: r.team_short_name.clone(),
            flag_emoji: r.flag_emoji.clone(),
            stage_label: stage_label(&r.stage).to_string(),
            stage: r.stage.clone(),
            base_points: r.base_points as u32,
            multiplier: r.multiplier as u32,
            total_points: r.total_points as u32,
        })
        .collect();

    Ok(Json(EventDetailResponse {
        id,
        name: event.name,
        short_name: event.short_name,
        event_type_label: label.to_string(),
        event_type: event.event_type,
        multiplier: mult,
        year: event.year as i32,
        host: event.host,
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
