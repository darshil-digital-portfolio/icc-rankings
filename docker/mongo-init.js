// MongoDB initialisation script – runs on first container boot.
// The actual data is seeded by the Rust API on startup.
db = db.getSiblingDB("icc_ranking");

// Create collections with schema validation hints (MongoDB 5+ JSON Schema).
db.createCollection("teams", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["slug", "name", "short_name"],
      properties: {
        slug:       { bsonType: "string" },
        name:       { bsonType: "string" },
        short_name: { bsonType: "string" },
      },
    },
  },
});

db.createCollection("events");
db.createCollection("event_results");

print("icc_ranking database initialised.");
