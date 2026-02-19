use axum::{
    routing::get,
    Router,
};
use serde_json::json;

use crate::{
    db::DbState,
    handlers::{events, rankings, teams},
};

/// Build the complete application router.
pub fn build_router(state: DbState) -> Router {
    let api_v1 = Router::new()
        // Rankings
        .route("/rankings", get(rankings::get_rankings))
        .route(
            "/rankings/team/:slug/breakdown",
            get(rankings::get_team_breakdown),
        )
        // Teams
        .route("/teams", get(teams::list_teams))
        .route("/teams/:slug", get(teams::get_team))
        // Events
        .route("/events", get(events::list_events))
        .route("/events/:id", get(events::get_event));

    Router::new()
        .route(
            "/health",
            get(|| async {
                axum::Json(json!({
                    "status": "ok",
                    "service": "icc-ranking-api",
                    "version": env!("CARGO_PKG_VERSION"),
                }))
            }),
        )
        .nest("/api/v1", api_v1)
        .with_state(state)
}
