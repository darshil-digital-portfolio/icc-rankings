CREATE TABLE teams (
    slug         TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    short_name   TEXT NOT NULL,
    flag_emoji   TEXT NOT NULL DEFAULT '',
    country_code TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_teams_name_trgm ON teams USING gin (name gin_trgm_ops);
