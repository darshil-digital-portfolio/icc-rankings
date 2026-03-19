CREATE TYPE event_type_enum AS ENUM (
    'women_u19',
    'men_u19',
    'women_t20_world_cup',
    'women_world_cup',
    'men_knockout_champions',
    'men_t20_world_cup',
    'test_championship',
    'men_world_cup'
);

CREATE TYPE stage_enum AS ENUM (
    'first_stage',
    'other_stage',
    'semi_final',
    'final',
    'champion'
);
