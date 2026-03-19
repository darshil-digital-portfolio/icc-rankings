use axum::{
    extract::{Path, Query, State},
    Json,
};
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

// ─── Row types for sqlx ──────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct TeamRow {
    slug: String,
    name: String,
    short_name: String,
    flag_emoji: String,
    country_code: String,
    total_points: Option<i64>,
    events_participated: Option<i64>,
    titles: Option<i64>,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/teams`
pub async fn list_teams(
    State(state): State<DbState>,
    Query(params): Query<TeamsQuery>,
) -> AppResult<Json<TeamsResponse>> {
    let pool = &state.db;

    let search_pattern = params.q.as_deref().map(|q| format!("%{}%", q));

    let rows = sqlx::query_as::<_, TeamRow>(
        "SELECT t.slug, t.name, t.short_name, t.flag_emoji, t.country_code,
                COALESCE(SUM(er.total_points), 0)::BIGINT AS total_points,
                COUNT(er.id)::BIGINT AS events_participated,
                SUM(CASE WHEN er.stage = 'champion' THEN 1 ELSE 0 END)::BIGINT AS titles
         FROM teams t
         LEFT JOIN event_results er ON er.team_slug = t.slug
         WHERE ($1::TEXT IS NULL OR t.name ILIKE $1)
         GROUP BY t.slug, t.name, t.short_name, t.flag_emoji, t.country_code
         ORDER BY total_points DESC
         LIMIT $2 OFFSET $3"
    )
    .bind(&search_pattern)
    .bind(params.limit as i64)
    .bind(params.offset as i64)
    .fetch_all(pool)
    .await?;

    let total_row: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT t.slug)::BIGINT
         FROM teams t
         WHERE ($1::TEXT IS NULL OR t.name ILIKE $1)"
    )
    .bind(&search_pattern)
    .fetch_one(pool)
    .await?;

    let summaries: Vec<TeamSummary> = rows
        .iter()
        .enumerate()
        .map(|(i, r)| TeamSummary {
            id: r.slug.clone(),
            slug: r.slug.clone(),
            name: r.name.clone(),
            short_name: r.short_name.clone(),
            flag_emoji: r.flag_emoji.clone(),
            country_code: r.country_code.clone(),
            total_points: r.total_points.unwrap_or(0) as u32,
            events_participated: r.events_participated.unwrap_or(0) as u32,
            titles: r.titles.unwrap_or(0) as u32,
            rank: params.offset + i as u32 + 1,
        })
        .collect();

    Ok(Json(TeamsResponse {
        data: summaries,
        meta: TeamsMeta {
            total: total_row.0 as u32,
            limit: params.limit,
            offset: params.offset,
        },
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

#[derive(sqlx::FromRow)]
struct HistoryRow {
    event_id: i32,
    event_name: String,
    event_short_name: String,
    event_type: String,
    year: i16,
    host: String,
    stage: String,
    base_points: i16,
    multiplier: i16,
    total_points: i16,
}

/// `GET /api/v1/teams/:slug`
pub async fn get_team(
    State(state): State<DbState>,
    Path(slug): Path<String>,
) -> AppResult<Json<TeamDetailResponse>> {
    let pool = &state.db;

    // Fetch team
    let team = sqlx::query_as::<_, crate::models::Team>(
        "SELECT slug, name, short_name, flag_emoji, country_code FROM teams WHERE slug = $1"
    )
    .bind(&slug)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Team '{}' not found", slug)))?;

    // Fetch history
    let rows = sqlx::query_as::<_, HistoryRow>(
        "SELECT e.id AS event_id, e.name AS event_name, e.short_name AS event_short_name,
                e.event_type::TEXT, e.year, e.host,
                er.stage::TEXT, er.base_points, er.multiplier, er.total_points
         FROM event_results er
         JOIN events e ON e.id = er.event_id
         WHERE er.team_slug = $1
         ORDER BY e.year ASC"
    )
    .bind(&slug)
    .fetch_all(pool)
    .await?;

    let mut total_points: u32 = 0;
    let mut titles: u32 = 0;

    let history: Vec<EventHistoryEntry> = rows
        .iter()
        .map(|r| {
            let pts = r.total_points as u32;
            total_points += pts;
            if r.stage == "champion" {
                titles += 1;
            }
            EventHistoryEntry {
                event_id: r.event_id.to_string(),
                event_name: r.event_name.clone(),
                event_short_name: r.event_short_name.clone(),
                event_type_label: event_type_label(&r.event_type).to_string(),
                event_type: r.event_type.clone(),
                year: r.year as i32,
                host: r.host.clone(),
                stage_label: stage_label(&r.stage).to_string(),
                stage: r.stage.clone(),
                base_points: r.base_points as u32,
                multiplier: r.multiplier as u32,
                total_points: pts,
            }
        })
        .collect();

    Ok(Json(TeamDetailResponse {
        id: team.slug.clone(),
        slug: team.slug,
        name: team.name,
        short_name: team.short_name,
        flag_emoji: team.flag_emoji,
        country_code: team.country_code,
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
