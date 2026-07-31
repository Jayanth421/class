const app = require("../app");
const { connectMongo } = require("../config/mongo");

let mongoConnectionPromise = null;

async function ensureMongoConnected() {
  if (mongoConnectionPromise) return mongoConnectionPromise;

  mongoConnectionPromise = connectMongo().catch((error) => {
    mongoConnectionPromise = null;
    throw error;
  });

  return mongoConnectionPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureMongoConnected();
  } catch (error) {
    console.error("Failed to connect MongoDB:", error?.message || error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ message: "Database connection failed" }));
    return;
  }

  return app(req, res);
};

