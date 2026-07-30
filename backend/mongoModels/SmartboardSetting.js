const mongoose = require("mongoose");

const smartboardSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      default: "default"
    },
    accessUser: {
      type: String,
      default: ""
    },
    accessKeyHash: {
      type: String,
      default: ""
    },
    defaultFacultyEmail: {
      type: String,
      default: ""
    },
    classIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }],
      default: []
    },
    classNames: {
      type: [String],
      default: []
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

smartboardSettingSchema.index({ key: 1 }, { unique: true });

module.exports =
  mongoose.models.SmartboardSetting || mongoose.model("SmartboardSetting", smartboardSettingSchema);
