-- Create a read-only PostgreSQL user for the Twelfth Man chatbot.
-- This script runs after the main database is initialised.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'icc_readonly') THEN
        CREATE ROLE icc_readonly WITH LOGIN PASSWORD 'icc_readonly_secret';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE icc_ranking TO icc_readonly;
GRANT USAGE ON SCHEMA public TO icc_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO icc_readonly;

-- Ensure future tables also get SELECT granted.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO icc_readonly;

-- Safety: 5-second statement timeout for the readonly user.
ALTER ROLE icc_readonly SET statement_timeout = '5s';
