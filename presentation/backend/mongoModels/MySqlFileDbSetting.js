const mongoose = require("mongoose");

const mySqlFileDbSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      default: "default"
    },
    enabled: {
      type: Boolean,
      default: false
    },
    host: {
      type: String,
      default: ""
    },
    port: {
      type: Number,
      default: 3306
    },
    user: {
      type: String,
      default: ""
    },
    pass: {
      type: String,
      default: ""
    },
    database: {
      type: String,
      default: ""
    },
    ssl: {
      type: Boolean,
      default: false
    },
    tableName: {
      type: String,
      default: "file_uploads"
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

mySqlFileDbSettingSchema.index({ key: 1 }, { unique: true });

module.exports =
  mongoose.models.MySqlFileDbSetting ||
  mongoose.model("MySqlFileDbSetting", mySqlFileDbSettingSchema);

