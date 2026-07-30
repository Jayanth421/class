const mongoose = require("mongoose");

const smtpSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      default: "default"
    },
    provider: {
      type: String,
      default: "node"
    },
    host: {
      type: String,
      default: ""
    },
    port: {
      type: Number,
      default: 587
    },
    secure: {
      type: Boolean,
      default: false
    },
    starttls: {
      type: Boolean,
      default: true
    },
    timeoutSeconds: {
      type: Number,
      default: 20
    },
    user: {
      type: String,
      default: ""
    },
    pass: {
      type: String,
      default: ""
    },
    apiKey: {
      type: String,
      default: ""
    },
    from: {
      type: String,
      default: ""
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

smtpSettingSchema.index({ key: 1 }, { unique: true });

module.exports =
  mongoose.models.SmtpSetting || mongoose.model("SmtpSetting", smtpSettingSchema);
