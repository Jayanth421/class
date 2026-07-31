const mongoose = require("mongoose");

const facultyClassSchema = new mongoose.Schema(
  {
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

facultyClassSchema.index({ facultyId: 1, classId: 1 }, { unique: true });

module.exports =
  mongoose.models.FacultyClass || mongoose.model("FacultyClass", facultyClassSchema);
