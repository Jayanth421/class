require("dotenv").config();

const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectMongo } = require("../config/mongo");
const User = require("../mongoModels/User");

const DEFAULT_ADMIN_EMAIL = "admin@cmrcet.ac.in";
const DEFAULT_ADMIN_PASSWORD = "Admin@123";
const DEFAULT_ADMIN_NAME = "Demo Admin";

async function ensureAdminAccess() {
  const email = String(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD);
  const name = String(process.env.ADMIN_NAME || DEFAULT_ADMIN_NAME).trim();

  if (!email || !password || !name) {
    throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME must be non-empty");
  }

  await connectMongo();

  const existingAdmin = await User.findOne({ email }).exec();
  const passwordHash = await bcrypt.hash(password, 12);

  if (existingAdmin) {
    await User.updateOne(
      { _id: existingAdmin._id },
      {
        $set: {
          name,
          passwordHash,
          role: "ADMIN",
          isVerified: true
        }
      }
    ).exec();
    console.log(`Admin account updated: ${email}`);
  } else {
    await User.create({
      name,
      email,
      passwordHash,
      role: "ADMIN",
      branch: "Administration",
      mobile: "9000000001",
      isVerified: true
    });
    console.log(`Admin account created: ${email}`);
  }
}

ensureAdminAccess()
  .catch((error) => {
    console.error("Failed to ensure admin access:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
