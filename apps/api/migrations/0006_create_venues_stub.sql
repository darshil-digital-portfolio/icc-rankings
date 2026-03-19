CREATE TABLE venues (
    id       SERIAL PRIMARY KEY,
    name     TEXT NOT NULL,
    city     TEXT NOT NULL DEFAULT '',
    country  TEXT NOT NULL DEFAULT '',
    capacity INTEGER
);
