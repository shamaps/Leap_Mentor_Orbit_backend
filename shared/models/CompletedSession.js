const mongoose = require("mongoose");

const completedSessionSchema = new mongoose.Schema(
    {
        requestId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            unique: true,
        },
        mentor: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports =
    mongoose.models.CompletedSession ||
    mongoose.model("CompletedSession", completedSessionSchema);
