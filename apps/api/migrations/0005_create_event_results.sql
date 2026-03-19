CREATE TABLE event_results (
    id           SERIAL PRIMARY KEY,
    event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_slug    TEXT NOT NULL REFERENCES teams(slug) ON DELETE CASCADE,
    stage        stage_enum NOT NULL,
    base_points  SMALLINT NOT NULL,
    multiplier   SMALLINT NOT NULL,
    total_points SMALLINT GENERATED ALWAYS AS (base_points * multiplier) STORED,
    UNIQUE (event_id, team_slug)
);

CREATE INDEX idx_event_results_event ON event_results (event_id);
CREATE INDEX idx_event_results_team ON event_results (team_slug);
CREATE INDEX idx_event_results_stage ON event_results (stage);
