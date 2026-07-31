const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 10
    },
    section: {
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

classSchema.index({ departmentId: 1, year: 1, section: 1 }, { unique: true });

module.exports = mongoose.models.Class || mongoose.model("Class", classSchema);
