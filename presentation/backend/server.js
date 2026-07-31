const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function loadEnvFiles() {
  const rootDir = __dirname;
  const explicitEnvFile = String(process.env.ENV_FILE || "").trim();

  if (explicitEnvFile) {
    dotenv.config({
      path: path.resolve(rootDir, explicitEnvFile),
      override: true
    });
    return;
  }

  dotenv.config({
    path: path.resolve(rootDir, ".env")
  });

  const mode = String(process.env.NODE_ENV || "development").trim().toLowerCase();
  if (mode === "production") {
    return;
  }

  const modeFilePath = path.resolve(rootDir, ".env.local");

  if (fs.existsSync(modeFilePath)) {
    dotenv.config({
      path: modeFilePath,
      override: false
    });
  }
}

loadEnvFiles();

const app = require("./app");
const { connectMongo } = require("./config/mongo");

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    const mongoConnection = await connectMongo();
    if (mongoConnection?.source) {
      console.log(`Mongo connected using ${mongoConnection.source} source`);
    }
    app.listen(PORT, () => {
      console.log(`CMR Smart Presentation backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
