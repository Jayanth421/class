const mongoose = require("mongoose");

const smartboardSessionSchema = new mongoose.Schema(
  {
    sessionToken: {
      type: String,
      required: true
    },
    smartboardName: {
      type: String,
      default: null
    },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    status: {
      type: String,
      enum: ["PENDING", "AUTHORIZED", "EXPIRED"],
      default: "PENDING"
    },
    expiresAt: {
      type: Date,
      required: true
    },
    authorizedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

smartboardSessionSchema.index({ sessionToken: 1 }, { unique: true });
smartboardSessionSchema.index({ status: 1 });
smartboardSessionSchema.index({ expiresAt: 1 });

module.exports =
  mongoose.models.SmartboardSession ||
  mongoose.model("SmartboardSession", smartboardSessionSchema);
