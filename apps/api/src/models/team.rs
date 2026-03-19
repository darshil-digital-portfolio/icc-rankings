use serde::{Deserialize, Serialize};

/// A cricketing nation / ICC member association.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Team {
    pub slug: String,
    pub name: String,
    pub short_name: String,
    pub flag_emoji: String,
    pub country_code: String,
}
