const { Types } = require("mongoose");
const User = require("../mongoModels/User");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mapUser(userDoc) {
  if (!userDoc) return null;

  return {
    id: userDoc.id,
    name: userDoc.name,
    email: userDoc.email,
    passwordHash: userDoc.passwordHash,
    role: userDoc.role,
    rollNumber: userDoc.rollNumber,
    branch: userDoc.branch,
    year: userDoc.year,
    section: userDoc.section,
    mobile: userDoc.mobile,
    profilePhoto: userDoc.profilePhoto,
    classId: userDoc.classId ? String(userDoc.classId) : null,
    isVerified: Boolean(userDoc.isVerified),
    lastLoginAt: userDoc.lastLoginAt || null,
    createdAt: userDoc.createdAt
  };
}

async function createUser({
  name,
  email,
  passwordHash,
  role,
  rollNumber = null,
  branch = null,
  year = null,
  section = null,
  mobile = null,
  profilePhoto = null,
  classId = null,
  isVerified = false
}) {
  const created = await User.create({
    name,
    email,
    passwordHash,
    role,
    rollNumber,
    branch,
    year,
    section,
    mobile,
    profilePhoto,
    classId,
    isVerified
  });

  return { insertId: created.id };
}

async function updatePendingUser(userId, data) {
  if (!Types.ObjectId.isValid(userId)) return { modifiedCount: 0 };

  const updatePayload = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.passwordHash !== undefined) updatePayload.passwordHash = data.passwordHash;
  if (data.role !== undefined) updatePayload.role = data.role;
  if (data.rollNumber !== undefined) updatePayload.rollNumber = data.rollNumber || null;
  if (data.branch !== undefined) updatePayload.branch = data.branch || null;
  if (data.year !== undefined) updatePayload.year = data.year || null;
  if (data.section !== undefined) updatePayload.section = data.section || null;
  if (data.mobile !== undefined) updatePayload.mobile = data.mobile || null;
  if (data.profilePhoto !== undefined) updatePayload.profilePhoto = data.profilePhoto || null;
  if (data.classId !== undefined) updatePayload.classId = data.classId || null;

  if (!Object.keys(updatePayload).length) return { modifiedCount: 0 };

  return User.updateOne(
    { _id: userId, isVerified: false },
    {
      $set: updatePayload
    }
  );
}

async function getUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const userDoc = await User.findOne({ email: normalized }).exec();
  return mapUser(userDoc);
}

async function getUserByLoginIdentifier(identifier) {
  const normalized = String(identifier || "").trim();
  if (!normalized) return null;

  if (normalized.includes("@")) {
    return getUserByEmail(normalized);
  }

  const byRollNumber = await User.findOne({ rollNumber: normalized.toUpperCase() }).exec();
  if (byRollNumber) return mapUser(byRollNumber);

  const aliasRegex = new RegExp(`^${escapeRegex(normalized.toLowerCase())}@`, "i");
  const aliasMatches = await User.find({ email: { $regex: aliasRegex } }).limit(2).exec();
  if (aliasMatches.length === 1) {
    return mapUser(aliasMatches[0]);
  }

  return null;
}

async function getUserById(userId) {
  if (!Types.ObjectId.isValid(userId)) return null;
  const userDoc = await User.findById(userId).exec();
  return mapUser(userDoc);
}

async function markUserAsVerified(userId) {
  if (!Types.ObjectId.isValid(userId)) return { modifiedCount: 0 };
  return User.updateOne({ _id: userId }, { $set: { isVerified: true } });
}

async function listUsersByRole(role) {
  const filter = role ? { role } : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).exec();
  return users.map((userDoc) => {
    const mapped = mapUser(userDoc);
    delete mapped.passwordHash;
    return mapped;
  });
}

async function updateUserPassword(userId, passwordHash) {
  if (!Types.ObjectId.isValid(userId)) return { modifiedCount: 0 };

  return User.updateOne(
    { _id: userId },
    {
      $set: {
        passwordHash
      }
    }
  );
}

async function markUserLogin(userId) {
  if (!Types.ObjectId.isValid(userId)) return { modifiedCount: 0 };
  return User.updateOne(
    { _id: userId },
    {
      $set: {
        lastLoginAt: new Date()
      }
    }
  );
}

async function updateStudentSetup(userId, data) {
  if (!Types.ObjectId.isValid(userId)) return { modifiedCount: 0 };

  return User.updateOne(
    { _id: userId, role: "STUDENT" },
    {
      $set: {
        rollNumber: data.rollNumber,
        name: data.name,
        year: data.year,
        branch: data.branch,
        section: data.section,
        mobile: data.mobile,
        profilePhoto: data.profilePhoto || null,
        classId: data.classId || null
      }
    }
  );
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserByLoginIdentifier,
  getUserById,
  listUsersByRole,
  markUserLogin,
  markUserAsVerified,
  updateStudentSetup,
  updatePendingUser,
  updateUserPassword
};
