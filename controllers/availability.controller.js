// controllers/availability.controller.js
const { handleError } = require("../utils/appError");
const { ok, created, noContent } = require("../utils/response");

/**
 * @typedef {Object} AvailabilityService
 * @property {(mentorId: string) => Promise<Object>} getMyAvailability
 * @property {(mentorId: string, body: Object) => Promise<Object>} createAvailability
 * @property {(mentorId: string, body: Object) => Promise<Object>} updateAvailability
 * @property {(mentorId: string) => Promise<Object>} getMentorAvailability
 * @property {(mentorId: string) => Promise<void>} deleteAvailability
 * @property {(mentorId: string, duration: number, userId: string) => Promise<Object>} getAvailableSlots
 */

/**
 * Factory constructing the structural Express presentation controllers.
 * * @param {AvailabilityService} availabilityService - Wired underlying operations logic context worker.
 * @param {{ logger: Logger }} dependencies - Global application tracking dependencies parameter.
 * @returns {Object} Bundle containing endpoint action mappings for routers.
 */
const createAvailabilityController = (availabilityService, { logger }) => {

  /**
   * Express Route Handler reading self properties.
   * * @async
   * @function getMyAvailability
   * @param {import('express').Request & { user: { _id: string } }} req - Augmented network request interface.
   * @param {import('express').Response} res - Standard connection output channel.
   */
  const getMyAvailability = async (req, res) => {
    try {
      const data = await availabilityService.getMyAvailability(req.user._id);
      logger.info("getMyAvailability completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "availability.getMyAvailability");
    }
  };

  /**
   * Express Route Handler writing base scheduling structures.
   * * @async
   * @function createAvailability
   * @param {import('express').Request & { user: { _id: string } }} req - Request payload interface context.
   * @param {import('express').Response} res - Success presentation execution pipeline.
   */
  const createAvailability = async (req, res) => {
    try {
      const availability = await availabilityService.createAvailability(req.user._id, req.body);
      logger.info("createAvailability completed successfully");
      return created(res, { message: "Availability created successfully", availability });
    } catch (err) {
      return handleError(res, err, "availability.createAvailability");
    }
  };

  /**
   * Express Route Handler updating select configuration details.
   * * @async
   * @function updateAvailability
   * @param {import('express').Request & { user: { _id: string } }} req - Request transaction parameter mapping.
   * @param {import('express').Response} res - Content return socket adapter.
   */
  const updateAvailability = async (req, res) => {
    try {
      const availability = await availabilityService.updateAvailability(req.user._id, req.body);
      logger.info("updateAvailability completed successfully");
      return ok(res, { message: "Availability updated successfully", availability });
    } catch (err) {
      return handleError(res, err, "availability.updateAvailability");
    }
  };

  /**
   * Express Route Handler exposing sanitization maps publicly.
   * * @async
   * @function getMentorAvailability
   * @param {import('express').Request} req - Route parameters pipeline mapping variables.
   * @param {import('express').Response} res - Outbound data pipeline interface.
   */
  const getMentorAvailability = async (req, res) => {
    try {
      const data = await availabilityService.getMentorAvailability(req.params.mentorId);
      logger.info("getMentorAvailability completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "availability.getMentorAvailability");
    }
  };

  /**
   * Express Route Handler discarding administrative profiles records.
   * * @async
   * @function deleteAvailability
   * @param {import('express').Request & { user: { _id: string } }} req - Request verification state container.
   * @param {import('express').Response} res - Termination state handler framework.
   */
  const deleteAvailability = async (req, res) => {
    try {
      await availabilityService.deleteAvailability(req.user._id);
      logger.info("deleteAvailability completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "availability.deleteAvailability");
    }
  };

  /**
   * Express Route Handler to resolve calculated open appointments.
   * * @async
   * @function getAvailableSlots
   * @param {import('express').Request & { user: { _id: string } }} req - Processing pipeline parameters and query arguments context.
   * @param {import('express').Response} res - Final structural payload output socket channel.
   */
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