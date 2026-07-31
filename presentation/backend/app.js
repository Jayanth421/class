require("dotenv").config();

const fs = require("fs");
const path = require("path");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const storageRoutes = require("./routes/storageRoutes");
const studentRoutes = require("./routes/studentRoutes");
const errorHandler = require("./middlewares/errorHandler");
const notFound = require("./middlewares/notFound");
const { getLocalUploadDir, getStorageProvider } = require("./services/storageService");

function readBooleanEnv(name, defaultValue = false) {
  const raw = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return defaultValue;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return defaultValue;
}

const app = express();
const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
const strictDevCors =
  String(process.env.STRICT_DEV_CORS || "")
    .trim()
    .toLowerCase() === "true";

const allowedOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOriginConfig =
  !isProduction && !strictDevCors
    ? true
    : allowedOrigins.length > 0
      ? allowedOrigins
      : true;

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: corsOriginConfig,
    credentials: true
  })
);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 200),
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "cmr-smart-presentation-backend" });
});

if (getStorageProvider() === "local") {
  const uploadDir = getLocalUploadDir();
  app.use("/files", express.static(uploadDir));
}

app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/storage", storageRoutes);

const shouldServeFrontend = readBooleanEnv("SERVE_FRONTEND", isProduction);
if (shouldServeFrontend) {
  const frontendDistDir = path.resolve(__dirname, "..", "frontend", "dist");
  const frontendIndex = path.join(frontendDistDir, "index.html");

  if (fs.existsSync(frontendIndex)) {
    app.use(express.static(frontendDistDir));

    // SPA fallback: hand non-API routes to the React app.
    app.get("*", (req, res, next) => {
      if (
        req.path === "/health" ||
        req.path.startsWith("/api") ||
        req.path.startsWith("/files")
      ) {
        return next();
      }

      return res.sendFile(frontendIndex);
    });
  }
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
