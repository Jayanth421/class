const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

departmentSchema.index({ code: 1 }, { unique: true });

module.exports =
  mongoose.models.Department || mongoose.model("Department", departmentSchema);
