const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
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

subjectSchema.index({ classId: 1, code: 1 }, { unique: true });
subjectSchema.index({ facultyId: 1 });

module.exports = mongoose.models.Subject || mongoose.model("Subject", subjectSchema);
