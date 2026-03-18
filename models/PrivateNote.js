// backend/models/PrivateNote.js
const mongoose = require("mongoose");

const privateNoteSchema = new mongoose.Schema(
  {
    connectRequest: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "ConnectRequest",
      required: true,
    },
    author: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    title: {
      type:      String,
      trim:      true,
      default:   "Untitled Note",
      maxlength: 200,
    },
    content: {
      type:    String,
      default: "",
    },
  },
  { timestamps: true }
);

// Fast queries for all notes by a user in a session
privateNoteSchema.index({ connectRequest: 1, author: 1, createdAt: -1 });

module.exports = mongoose.model("PrivateNote", privateNoteSchema);