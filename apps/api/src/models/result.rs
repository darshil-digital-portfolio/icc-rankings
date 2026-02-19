use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::scoring::Stage;

/// The result of a single team's participation in a single ICC event.
///
/// Points stored here are pre-calculated at seed / insert time so that
/// aggregation queries remain fast without recomputing multipliers on every read.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventResult {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Reference to the `events` collection.
    pub event_id: ObjectId,

    /// Reference to the `teams` collection.
    pub team_id: ObjectId,

    /// The furthest stage the team reached.
    pub stage: Stage,

    /// Raw stage points (1–5) before the event multiplier.
    pub base_points: u32,

    /// The event-type multiplier (1–8).
    pub multiplier: u32,

    /// Final awarded points: `base_points × multiplier`.
    pub total_points: u32,

    pub created_at: DateTime<Utc>,
}

impl EventResult {
    pub fn new(
        event_id: ObjectId,
        team_id: ObjectId,
        stage: Stage,
        base_points: u32,
        multiplier: u32,
    ) -> Self {
        Self {
            id: None,
            event_id,
            team_id,
            stage,
            base_points,
            multiplier,
            total_points: base_points * multiplier,
            created_at: Utc::now(),
        }
    }
}

pub const COLLECTION: &str = "event_results";
