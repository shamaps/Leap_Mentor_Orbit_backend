const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS ,applySoftDelete} = require("../utils/baseSchema");

const milestoneSchema = new mongoose.Schema(
  {
    goal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Goal",
      required: true,
    },
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: true, // denormalized for easy querying without joining Goal
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    dueDate: {
      type: String, // "YYYY-MM-DD"
      default: null,
      maxlength: 10,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    order: {
      type: Number,
      default: 0, // for future drag-to-reorder
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    //  NEW — which session slot this milestone belongs to
// null  = goal-level milestone (general, not tied to a session)
// 0,1,2 = belongs to selectedSlots[0], selectedSlots[1], selectedSlots[2]
slotIndex: {
  type: Number,
  default: null,
},
  },
  BASE_SCHEMA_OPTIONS
);

milestoneSchema.index({ goal: 1, order: 1 });
milestoneSchema.index({ connectRequest: 1 });
milestoneSchema.index({ goal: 1, slotIndex: 1, order: 1 }); 
applySoftDelete(milestoneSchema)
module.exports = mongoose.model("Milestone", milestoneSchema);