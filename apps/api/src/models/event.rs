use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::scoring::EventType;

/// A single ICC tournament edition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Human-readable name, e.g. `"ICC Men's Cricket World Cup 2023"`.
    pub name: String,

    /// Short label for compact displays, e.g. `"CWC 2023"`.
    pub short_name: String,

    /// Determines the point multiplier applied to all results in this event.
    pub event_type: EventType,

    /// Calendar year the tournament was held / concluded.
    pub year: i32,

    /// Host nation(s), e.g. `"India"` or `"Australia & New Zealand"`.
    pub host: String,

    pub created_at: DateTime<Utc>,
}

impl Event {
    pub fn new(
        name: impl Into<String>,
        short_name: impl Into<String>,
        event_type: EventType,
        year: i32,
        host: impl Into<String>,
    ) -> Self {
        Self {
            id: None,
            name: name.into(),
            short_name: short_name.into(),
            event_type,
            year,
            host: host.into(),
            created_at: Utc::now(),
        }
    }
}

pub const COLLECTION: &str = "events";
