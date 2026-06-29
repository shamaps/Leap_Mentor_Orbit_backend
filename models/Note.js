// backend/models/Note.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS,applySoftDelete } = require("../utils/baseSchema");

const noteSchema = new mongoose.Schema(
  {
    connectRequest: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "ConnectRequest",
      required: true,
    },
    uploadedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    uploaderRole: {
      type:     String,
      enum:     ["mentor", "mentee"],
      required: true,
    },
    title: {
      type:      String,
      trim:      true,
      default:   "",
      maxlength: 200,
    },
    fileUrl: {
      type:     String,
      required: true,
    },
    publicId: {
      type:     String,
      required: true,
    },
    fileType: {
      type:    String,
      enum:    ["pdf", "image", "doc", "ppt", "excel", "txt", "other"],
      default: "other",
    },
    fileName: {
      type:    String,
      trim:    true,
      default: "",
    },
    fileSize: {
      type:    Number,
      default: 0,
    },
    thumbnailUrl: { type: String, default: "" }, 
    // NEW — private notes only visible to uploader
    isPrivate: {
      type:    Boolean,
      default: false,
    },
  },
  BASE_SCHEMA_OPTIONS
);

noteSchema.index({ connectRequest: 1, createdAt: -1 });
noteSchema.index({ uploadedBy: 1 });
noteSchema.index({ connectRequest: 1, uploadedBy: 1, isPrivate: 1 });

applySoftDelete(noteSchema);
module.exports = mongoose.model("Note", noteSchema);