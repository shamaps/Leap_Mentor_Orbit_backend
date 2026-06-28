// swagger/_shared.js
//
// Reusable OpenAPI component schemas, referenced via $ref from every
// *.paths.js file. These shapes are NOT guessed — they mirror the real
// envelopes produced by utils/response.js and utils/appError.js:
//
//   ok(res, data)            -> { success: true,  data }                (200)
//   created(res, data)       -> { success: true,  data }                (201)
//   fail(res, message)       -> { success: false, message }             (4xx)
//   noContent(res)           -> 204, empty body
//   unprocessable(res, msg)  -> { success: false, message, code: "UNPROCESSABLE", ...meta } (422)
//   AppError -> handleError  -> { success: false, message, ...meta }     (err.status)
//   Mongoose ValidationError -> { success: false, errors: [{field, message}] } (400)
//   Duplicate key (11000)    -> { success: false, message: "<field> already exists" } (409)
//   Uncaught/unexpected      -> { success: false, message: "Internal server error" }   (500)

module.exports = {
    // ---- generic envelopes ----
    SuccessEnvelope: {
        type: "object",
        properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" },
        },
    },

    ErrorResponse: {
        type: "object",
        description: "Standard error shape returned by fail() / AppError via handleError().",
        properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Something went wrong" },
        },
    },

    ValidationErrorResponse: {
        type: "object",
        description: "Returned for Joi validation failures (middleware/validate.js) and Mongoose ValidationError.",
        properties: {
            success: { type: "boolean", example: false },
            errors: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        field: { type: "string", example: "email" },
                        message: { type: "string", example: "\"email\" must be a valid email" },
                    },
                },
            },
        },
    },

    UnprocessableResponse: {
        type: "object",
        description: "Returned by unprocessable() — request is well-formed but semantically invalid (e.g. slot already booked, escrow already paid).",
        properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Slot is no longer available" },
            code: { type: "string", example: "UNPROCESSABLE" },
        },
    },

    ConflictResponse: {
        type: "object",
        description: "Returned on MongoDB duplicate key violation (E11000), e.g. registering with an email that already exists.",
        properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "email already exists" },
        },
    },

    InternalErrorResponse: {
        type: "object",
        properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Internal server error" },
        },
    },

    // ---- domain objects ----
    SanitizedUser: {
        type: "object",
        description: "toUserDTO() output — password, passwordChangedAt, __v, isDeleted, deletedAt stripped.",
        properties: {
            id: { type: "string", example: "665f1c2e4b1a2c001f8e9a11" },
            _id: { type: "string", example: "665f1c2e4b1a2c001f8e9a11" },
            name: { type: "string", example: "Jane Doe" },
            email: { type: "string", format: "email", example: "jane@example.com" },
            roles: {
                type: "array",
                items: { type: "string", enum: ["mentor", "mentee"] },
                example: ["mentee"],
            },
            isEmailVerified: { type: "boolean", example: true },
            termsAccepted: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time", example: "2026-06-20T10:15:00.000Z" },
        },
    },

    // Standard cursor-pagination envelope used by message/notification list endpoints
    CursorPage: {
        type: "object",
        properties: {
            success: { type: "boolean", example: true },
            data: { type: "array", items: {} },
            nextCursor: { type: "string", nullable: true, example: "665f1c2e4b1a2c001f8e9a99" },
            hasMore: { type: "boolean", example: true },
        },
    },
};
