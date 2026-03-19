CREATE TABLE events (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    short_name   TEXT NOT NULL,
    event_type   event_type_enum NOT NULL,
    year         SMALLINT NOT NULL,
    host         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_events_type_year ON events (event_type, year DESC);
CREATE INDEX idx_events_year ON events (year DESC);
