use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{db::DbState, error::{AppError, AppResult}};

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

// ─── Row types ────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct RankingRow {
    team_slug: String,
    team_name: String,
    team_short_name: String,
    flag_emoji: String,
    total_points: Option<i64>,
    events_participated: Option<i64>,
    titles: Option<i64>,
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/// `GET /api/v1/rankings`
pub async fn get_rankings(
    State(state): State<DbState>,
    Query(params): Query<RankingsQuery>,
) -> AppResult<Json<RankingsResponse>> {
    let pool = &state.db;

    // Parse comma-separated event types into a Vec for SQL array binding.
    // None = no filter (all formats); Some(vec) = filter to those types.
    let event_types: Option<Vec<String>> = params.event_type
        .as_deref()
        .map(|s| s.split(',').filter(|t| !t.is_empty()).map(str::to_owned).collect());

    let rows = sqlx::query_as::<_, RankingRow>(
        "SELECT t.slug AS team_slug, t.name AS team_name, t.short_name AS team_short_name,
                t.flag_emoji,
                SUM(er.total_points)::BIGINT AS total_points,
                COUNT(er.id)::BIGINT AS events_participated,
                SUM(CASE WHEN er.stage = 'champion' THEN 1 ELSE 0 END)::BIGINT AS titles
         FROM event_results er
         JOIN teams t ON t.slug = er.team_slug
         LEFT JOIN events e ON e.id = er.event_id
         WHERE ($1::TEXT[] IS NULL OR e.event_type::TEXT = ANY($1::TEXT[]))
         GROUP BY t.slug, t.name, t.short_name, t.flag_emoji
         ORDER BY total_points DESC
         LIMIT $2 OFFSET $3"
    )
    .bind(&event_types)
    .bind(params.limit as i64)
    .bind(params.offset as i64)
    .fetch_all(pool)
    .await?;

    let total_row: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT er.team_slug)::BIGINT
         FROM event_results er
         LEFT JOIN events e ON e.id = er.event_id
         WHERE ($1::TEXT[] IS NULL OR e.event_type::TEXT = ANY($1::TEXT[]))"
    )
    .bind(&event_types)
    .fetch_one(pool)
    .await?;

    let entries: Vec<RankingEntry> = rows
        .iter()
        .enumerate()
        .map(|(i, r)| RankingEntry {
            rank: params.offset + i as u32 + 1,
            team_id: r.team_slug.clone(),
            team_slug: r.team_slug.clone(),
            team_name: r.team_name.clone(),
            team_short_name: r.team_short_name.clone(),
            flag_emoji: r.flag_emoji.clone(),
            total_points: r.total_points.unwrap_or(0) as u32,
            events_participated: r.events_participated.unwrap_or(0) as u32,
            titles: r.titles.unwrap_or(0) as u32,
        })
        .collect();

    Ok(Json(RankingsResponse {
        data: entries,
        meta: RankingsMeta {
            total: total_row.0 as u32,
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

#[derive(sqlx::FromRow)]
struct BreakdownRow {
    event_type: String,
    total_points: Option<i64>,
    events_participated: Option<i64>,
    titles: Option<i64>,
}

/// `GET /api/v1/rankings/team/:slug/breakdown`
pub async fn get_team_breakdown(
    State(state): State<DbState>,
    Path(slug): Path<String>,
) -> AppResult<Json<TeamBreakdownResponse>> {
    let pool = &state.db;

    // Find team by slug
    let team = sqlx::query_as::<_, crate::models::Team>(
        "SELECT slug, name, short_name, flag_emoji, country_code FROM teams WHERE slug = $1"
    )
    .bind(&slug)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Team '{}' not found", slug)))?;

    let rows = sqlx::query_as::<_, BreakdownRow>(
        "SELECT e.event_type::TEXT,
                SUM(er.total_points)::BIGINT AS total_points,
                COUNT(er.id)::BIGINT AS events_participated,
                SUM(CASE WHEN er.stage = 'champion' THEN 1 ELSE 0 END)::BIGINT AS titles
         FROM event_results er
         JOIN events e ON e.id = er.event_id
         WHERE er.team_slug = $1
         GROUP BY e.event_type
         ORDER BY total_points DESC"
    )
    .bind(&slug)
    .fetch_all(pool)
    .await?;

    let mut grand_total: u32 = 0;
    let breakdown: Vec<BreakdownEntry> = rows
        .iter()
        .map(|r| {
            let pts = r.total_points.unwrap_or(0) as u32;
            grand_total += pts;
            let (label, mult) = event_type_meta(&r.event_type);
            BreakdownEntry {
                event_type: r.event_type.clone(),
                event_type_label: label.to_string(),
                multiplier: mult,
                total_points: pts,
                events_participated: r.events_participated.unwrap_or(0) as u32,
                titles: r.titles.unwrap_or(0) as u32,
            }
        })
        .collect();

    Ok(Json(TeamBreakdownResponse {
        team_slug: slug,
        team_name: team.name,
        flag_emoji: team.flag_emoji,
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
