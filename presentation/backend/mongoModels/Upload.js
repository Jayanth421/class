const mongoose = require("mongoose");

const uploadSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    s3Key: {
      type: String,
      required: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    title: {
      type: String,
      default: null,
      trim: true
    },
    description: {
      type: String,
      default: null,
      trim: true
    },
    fileName: {
      type: String,
      default: null
    },
    fileType: {
      type: String,
      default: null
    },
    category: {
      type: String,
      enum: ["STUDENT_PRESENTATION", "LECTURE_MATERIAL"],
      default: "STUDENT_PRESENTATION"
    },
    status: {
      type: String,
      enum: ["PENDING", "UPLOADED", "APPROVED", "REJECTED"],
      default: "UPLOADED"
    },
    feedback: {
      type: String,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

uploadSchema.index({ uploadedBy: 1 });
uploadSchema.index({ subjectId: 1 });
uploadSchema.index({ category: 1, status: 1 });

module.exports = mongoose.models.Upload || mongoose.model("Upload", uploadSchema);
