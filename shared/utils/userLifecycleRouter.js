const express = require("express");
const { requireInternalAuth } = require("../middleware/internalAuth");
const { handleError } = require("./appError");

const OBJECT_ID = /^[a-f\d]{24}$/i;

const createUserLifecycleRouter = ({ service, handlers }) => {
    const router = express.Router();
    router.use(requireInternalAuth({ service, callers: ["identity"] }));

    const route = (handler, label) => async (req, res) => {
        const { userId } = req.params;
        if (!OBJECT_ID.test(userId)) {
            return res.status(400).json({ success: false, message: "userId must be a valid ID" });
        }
        try {
            const data = await handler(userId);
            return res.json({ success: true, data });
        } catch (error) {
            return handleError(res, error, `${service}.internal.users.${label}`);
        }
    };

    if (handlers.hardDelete) router.delete("/:userId", route(handlers.hardDelete, "hardDelete"));
    if (handlers.softDelete) router.post("/:userId/soft-delete", route(handlers.softDelete, "softDelete"));
    if (handlers.restore) router.post("/:userId/restore", route(handlers.restore, "restore"));
    return router;
};

module.exports = { createUserLifecycleRouter };