use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A cricketing nation / ICC member association.
///
/// One `Team` document represents a country. Points from all formats
/// (men, women, U19) accumulate to the same team document so that the
/// overall ranking reflects a nation's complete ICC history.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// URL-safe unique identifier, e.g. `"india"`, `"west-indies"`.
    pub slug: String,

    /// Full display name, e.g. `"India"`, `"West Indies"`.
    pub name: String,

    /// Three-letter abbreviation used in scorecards, e.g. `"IND"`.
    pub short_name: String,

    /// Unicode flag emoji for quick visual identification.
    pub flag_emoji: String,

    /// ISO 3166-1 alpha-2 country code (empty for combined teams like East Africa).
    pub country_code: String,

    /// Insertion timestamp.
    pub created_at: DateTime<Utc>,
}

impl Team {
    pub fn new(
        slug: impl Into<String>,
        name: impl Into<String>,
        short_name: impl Into<String>,
        flag_emoji: impl Into<String>,
        country_code: impl Into<String>,
    ) -> Self {
        Self {
            id: None,
            slug: slug.into(),
            name: name.into(),
            short_name: short_name.into(),
            flag_emoji: flag_emoji.into(),
            country_code: country_code.into(),
            created_at: Utc::now(),
        }
    }
}

/// Collection name constant.
pub const COLLECTION: &str = "teams";
