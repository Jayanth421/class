const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["ADMIN", "FACULTY", "STUDENT", "SMARTBOARD"],
      required: true
    },
    rollNumber: {
      type: String,
      default: null
    },
    branch: {
      type: String,
      default: null
    },
    year: {
      type: Number,
      default: null
    },
    section: {
      type: String,
      default: null
    },
    mobile: {
      type: String,
      default: null
    },
    profilePhoto: {
      type: String,
      default: null
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    lastLoginAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index(
  { rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rollNumber: { $exists: true, $type: "string" }
    }
  }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
