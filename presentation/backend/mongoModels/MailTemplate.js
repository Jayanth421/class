const mongoose = require("mongoose");

const mailTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    text: {
      type: String,
      default: ""
    },
    html: {
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

mailTemplateSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.models.MailTemplate || mongoose.model("MailTemplate", mailTemplateSchema);

