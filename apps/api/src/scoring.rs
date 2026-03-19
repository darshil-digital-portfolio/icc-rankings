use serde::{Deserialize, Serialize};

// ─── Stage ────────────────────────────────────────────────────────────────────

/// The furthest stage a team reached in a tournament.
///
/// Base points:
/// - FirstStage  → 1
/// - OtherStage  → 2  (quarter-finals, Super-8, Super-12, league phase exits)
/// - SemiFinal   → 3
/// - Final       → 4
/// - Champion    → 5
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(clippy::enum_variant_names)]
pub enum Stage {
    /// Eliminated in the opening group / first round.
    FirstStage,
    /// Advanced past the first stage but did not reach a semi-final
    /// (e.g. quarter-final exit, Super-8/12 exit).
    OtherStage,
    /// Lost in a semi-final.
    SemiFinal,
    /// Lost in the final.
    Final,
    /// Tournament winner.
    Champion,
}

impl Stage {
    pub fn base_points(self) -> u32 {
        match self {
            Stage::FirstStage => 1,
            Stage::OtherStage => 2,
            Stage::SemiFinal  => 3,
            Stage::Final      => 4,
            Stage::Champion   => 5,
        }
    }

    #[allow(dead_code)]
    pub fn label(self) -> &'static str {
        match self {
            Stage::FirstStage => "Group Stage",
            Stage::OtherStage => "Quarter-Final / Super Stage",
            Stage::SemiFinal  => "Semi-Final",
            Stage::Final      => "Runner-Up",
            Stage::Champion   => "Champion",
        }
    }
}

// ─── EventType ────────────────────────────────────────────────────────────────

/// The type of ICC event, which determines the point multiplier.
///
/// Multipliers (Phase 1 – fixed):
/// - WomenU19             → 1×
/// - MenU19               → 2×
/// - WomenT20WorldCup     → 3×
/// - WomenWorldCup        → 4×
/// - MenKnockoutChampions → 5×
/// - MenT20WorldCup       → 6×
/// - TestChampionship     → 7×
/// - MenWorldCup          → 8×
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    WomenU19,
    MenU19,
    WomenT20WorldCup,
    WomenWorldCup,
    MenKnockoutChampions,
    MenT20WorldCup,
    TestChampionship,
    MenWorldCup,
}

impl EventType {
    pub fn multiplier(self) -> u32 {
        match self {
            EventType::WomenU19             => 1,
            EventType::MenU19               => 2,
            EventType::WomenT20WorldCup     => 3,
            EventType::WomenWorldCup        => 4,
            EventType::MenKnockoutChampions => 5,
            EventType::MenT20WorldCup       => 6,
            EventType::TestChampionship     => 7,
            EventType::MenWorldCup          => 8,
        }
    }

    #[allow(dead_code)]
    pub fn label(self) -> &'static str {
        match self {
            EventType::WomenU19             => "Women's U19 World Cup",
            EventType::MenU19               => "Men's U19 World Cup",
            EventType::WomenT20WorldCup     => "Women's T20 World Cup",
            EventType::WomenWorldCup        => "Women's World Cup",
            EventType::MenKnockoutChampions => "Men's Knockout / Champions Trophy",
            EventType::MenT20WorldCup       => "Men's T20 World Cup",
            EventType::TestChampionship     => "World Test Championship",
            EventType::MenWorldCup          => "Men's Cricket World Cup",
        }
    }

    /// Gender tag used for UI filtering.
    #[allow(dead_code)]
    pub fn gender(self) -> &'static str {
        match self {
            EventType::WomenU19 | EventType::WomenT20WorldCup | EventType::WomenWorldCup => "women",
            EventType::MenU19
            | EventType::MenKnockoutChampions
            | EventType::MenT20WorldCup
            | EventType::TestChampionship
            | EventType::MenWorldCup => "men",
        }
    }
}

// ─── Calculation ─────────────────────────────────────────────────────────────

/// Calculate points earned by a team for a single event.
///
/// ```
/// points = stage.base_points() × event_type.multiplier()
/// ```
#[cfg(test)]
pub fn calculate_points(stage: Stage, event_type: EventType) -> u32 {
    stage.base_points() * event_type.multiplier()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn champion_men_world_cup_is_40() {
        assert_eq!(calculate_points(Stage::Champion, EventType::MenWorldCup), 40);
    }

    #[test]
    fn first_stage_women_u19_is_1() {
        assert_eq!(calculate_points(Stage::FirstStage, EventType::WomenU19), 1);
    }

    #[test]
    fn semi_finalist_t20_wc_is_18() {
        assert_eq!(calculate_points(Stage::SemiFinal, EventType::MenT20WorldCup), 18);
    }
}
