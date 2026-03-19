use serde::{Deserialize, Serialize};

/// A single ICC tournament edition.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Event {
    pub id: i32,
    pub name: String,
    pub short_name: String,
    pub event_type: String,
    pub year: i16,
    pub host: String,
}
