const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    audienceRoles: [
      {
        type: String,
        enum: ["ADMIN", "FACULTY", "STUDENT", "SMARTBOARD"],
        required: true
      }
    ],
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH"],
      default: "NORMAL"
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

announcementSchema.index({ audienceRoles: 1, createdAt: -1 });
announcementSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
