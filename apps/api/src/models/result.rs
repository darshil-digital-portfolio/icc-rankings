use serde::{Deserialize, Serialize};

/// The result of a single team's participation in a single ICC event.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EventResult {
    pub id: i32,
    pub event_id: i32,
    pub team_slug: String,
    pub stage: String,
    pub base_points: i16,
    pub multiplier: i16,
    pub total_points: i16,
}
