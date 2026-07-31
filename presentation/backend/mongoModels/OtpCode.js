const mongoose = require("mongoose");

const otpCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    otpHash: {
      type: String,
      required: true
    },
    purpose: {
      type: String,
      enum: ["REGISTRATION", "SMARTBOARD_LOGIN", "PASSWORD_RESET"],
      required: true
    },
    contextToken: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true
    },
    usedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

otpCodeSchema.index({ email: 1, purpose: 1, contextToken: 1, createdAt: -1 });
otpCodeSchema.index({ expiresAt: 1 });

module.exports = mongoose.models.OtpCode || mongoose.model("OtpCode", otpCodeSchema);
