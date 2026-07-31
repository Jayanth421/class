const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectMongo } = require("../config/mongo");
const { ROLES } = require("../config/constants");
const User = require("../mongoModels/User");
const { normalizeEmail, validateEmailByRole } = require("../utils/emailRules");

function loadEnvFiles() {
  const rootDir = path.resolve(__dirname, "..");
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
  if (mode === "production") return;

  const modeFilePath = path.resolve(rootDir, ".env.local");
  if (fs.existsSync(modeFilePath)) {
    dotenv.config({
      path: modeFilePath,
      override: false
    });
  }
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || "").trim();
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = String(argv[index + 1] || "").trim();
    if (!next || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      index += 1;
    }
  }
  return out;
}

function printUsage() {
  console.log("Usage:");
  console.log(
    "  node scripts/create_faculty_dev_user.js --email <faculty@cmrcet.ac.in> --password <Password123> [--name <Faculty Name>]"
  );
}

async function run() {
  loadEnvFiles();

  const mode = String(process.env.NODE_ENV || "development").trim().toLowerCase();
  if (mode === "production") {
    throw new Error("Refusing to run in production mode.");
  }

  const args = parseArgs(process.argv.slice(2));
  const normalizedEmail = normalizeEmail(args.email);
  const password = String(args.password || "");
  const fallbackName = normalizedEmail ? normalizedEmail.split("@")[0] : "Faculty";
  const normalizedName = String(args.name || fallbackName).trim() || "Faculty";

  if (!normalizedEmail || !password) {
    printUsage();
    throw new Error("email and password are required");
  }

  if (!validateEmailByRole(normalizedEmail, ROLES.FACULTY)) {
    throw new Error("email must be a valid faculty email (example: name@cmrcet.ac.in)");
  }

  if (password.length < 8) {
    throw new Error("password must be at least 8 characters");
  }

  await connectMongo();

  const existing = await User.findOne({ email: normalizedEmail }).select("_id role").lean().exec();
  if (existing?.role && existing.role !== ROLES.FACULTY) {
    throw new Error(`Cannot overwrite existing ${existing.role} account with FACULTY role`);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
        role: ROLES.FACULTY,
        isVerified: true
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .select("_id email name role isVerified")
    .lean()
    .exec();

  console.log("Faculty login account is ready:");
  console.log(JSON.stringify({
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: Boolean(user.isVerified)
  }, null, 2));
}

run()
  .catch(async (error) => {
    console.error(`create_faculty_dev_user failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_error) {
      // ignore
    }
  });
