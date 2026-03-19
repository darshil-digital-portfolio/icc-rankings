CREATE TABLE players (
    id             SERIAL PRIMARY KEY,
    team_slug      TEXT REFERENCES teams(slug) ON DELETE SET NULL,
    full_name      TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT '',
    batting_style  TEXT NOT NULL DEFAULT '',
    bowling_style  TEXT NOT NULL DEFAULT '',
    dob            DATE
);
