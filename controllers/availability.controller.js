// controllers/availability.controller.js
const availabilityService = require("../services/availability.service");

const { logger } = require("@sentry/node");

// GET /api/availability/me
const getMyAvailability = async (req, res) => {
  try {
    const data = await availabilityService.getMyAvailability(req.user._id);
    logger.info("getMyAvailability completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in availability.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/availability
// ─────────────────────────────────────────────────────────────
const createAvailability = async (req, res) => {
  try {
    const availability = await availabilityService.createAvailability(req.user._id, req.body);
    logger.info("createAvailability completed successfully");
    return res.status(201).json({ message: "Availability created successfully", availability });
  } catch (err) {
    const status = err.statusCode || 500;
    logger.error("Unhandled error in availability.controller", { error: err.message, stack: err.stack });
    return res.status(status).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/availability/me
// ─────────────────────────────────────────────────────────────
const updateAvailability = async (req, res) => {
  try {
    const availability = await availabilityService.updateAvailability(req.user._id, req.body);
    logger.info("updateAvailability completed successfully");
    return res.json({ message: "Availability updated successfully", availability });
  } catch (err) {
    const status = err.statusCode || 500;
    logger.error("Unhandled error in availability.controller", { error: err.message, stack: err.stack });
    return res.status(status).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/availability/:mentorId  (public)
// ─────────────────────────────────────────────────────────────
const getMentorAvailability = async (req, res) => {
  try {
    const data = await availabilityService.getMentorAvailability(req.params.mentorId);
    logger.info("getMentorAvailability completed successfully");
    return res.json(data);
  } catch (err) {
    const status = err.statusCode || 500;
    logger.error("Unhandled error in availability.controller", { error: err.message, stack: err.stack });
    return res.status(status).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/availability/me
// ─────────────────────────────────────────────────────────────
const deleteAvailability = async (req, res) => {
  try {
    await availabilityService.deleteAvailability(req.user._id);
    logger.info("deleteAvailability completed successfully");
    return res.status(204).send();
  } catch (err) {
    logger.error("Unhandled error in availability.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/availability/:mentorId/slots?duration=60
// ─────────────────────────────────────────────────────────────
const getAvailableSlots = async (req, res) => {
  try {
    const duration = Number.parseInt(req.query.duration) || 60;
    const data = await availabilityService.getAvailableSlots(
      req.params.mentorId,
      duration,
      req.user._id
    );
    logger.info("availability.controller completed successfully");
    return res.json(data);
  } catch (err) {
    const status = err.statusCode || 500;
    logger.error("Unhandled error in availability.controller", { error: err.message, stack: err.stack });
    return res.status(status).json({ message: err.message });
  }
};

module.exports = {
  getMyAvailability,
  createAvailability,
  updateAvailability,
  getMentorAvailability,
  deleteAvailability,
  getAvailableSlots,
};