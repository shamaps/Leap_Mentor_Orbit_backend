// controllers/availability.controller.js
const { handleError } = require("../utils/appError");
const { ok, created, noContent } = require("../utils/response");
const createAvailabilityController = (availabilityService, { logger }) => {
// GET /api/availability/me
const getMyAvailability = async (req, res) => {
  try {
    const data = await availabilityService.getMyAvailability(req.user._id);
    logger.info("getMyAvailability completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "availability.getMyAvailability");
  }
};


// POST /api/availability

const createAvailability = async (req, res) => {
  try {
    const availability = await availabilityService.createAvailability(req.user._id, req.body);
    logger.info("createAvailability completed successfully");
    return created(res, { message: "Availability created successfully", availability });
  } catch (err) {
    return handleError(res, err, "availability.createAvailability");
  }
};


// PATCH /api/availability/me

const updateAvailability = async (req, res) => {
  try {
    const availability = await availabilityService.updateAvailability(req.user._id, req.body);
    logger.info("updateAvailability completed successfully");
    return ok(res, { message: "Availability updated successfully", availability });
  } catch (err) {
    return handleError(res, err, "availability.updateAvailability");

  }
};


// GET /api/availability/:mentorId  (public)

const getMentorAvailability = async (req, res) => {
  try {
    const data = await availabilityService.getMentorAvailability(req.params.mentorId);
    logger.info("getMentorAvailability completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "availability.getMentorAvailability");
  }
};


// DELETE /api/availability/me

const deleteAvailability = async (req, res) => {
  try {
    await availabilityService.deleteAvailability(req.user._id);
    logger.info("deleteAvailability completed successfully");
    return noContent(res);
  } catch (err) {
    return handleError(res, err, "availability.deleteAvailability");

  }
};


// GET /api/availability/:mentorId/slots?duration=60

const getAvailableSlots = async (req, res) => {
  try {
    const duration = Number.parseInt(req.query.duration) || 60;
    const data = await availabilityService.getAvailableSlots(
      req.params.mentorId,
      duration,
      req.user._id
    );
    logger.info("availability.controller completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "availability.getAvailableSlots");
  }
};

  return { getMyAvailability, createAvailability, updateAvailability, getMentorAvailability, deleteAvailability, getAvailableSlots };
};
module.exports = createAvailabilityController;