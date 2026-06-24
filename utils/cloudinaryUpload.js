const { cloudinary } = require("../config/cloudinary");
const streamifier = require("streamifier");
const { withRetry } = require("./withRetry");
const { getTraceId } = require("./requestContext"); 

// Cloudinary Access Control Policy
//
// PROFILE PICTURES  → type: "upload" (public)
//   Rationale: Profile pictures are intentionally public — any authenticated
//   user browsing mentors needs to see them without signed URLs.
//   ACL: publicly readable, write-protected by Cloudinary API key.
//
// VERIFICATION DOCS → type: "authenticated" (private)
//   Rationale: Resume and work experience docs contain PII and must only
//   be accessible to admins during the verification workflow.
//   ACL: requires signed URL with expiry — generated server-side only.

const attemptUpload = (buffer, options) =>
    new Promise((resolve, reject) => {
        const optionsWithTrace = {
            ...options,
            context: {
                ...(options.context || {}),
                traceId: getTraceId(),                       
            },
        };
        const stream = cloudinary.uploader.upload_stream(
            optionsWithTrace,                                
            (error, result) => {
                if (error) return reject(new Error(error.message ?? JSON.stringify(error)));
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });

const uploadToCloudinary = (buffer, options) =>
    withRetry(() => attemptUpload(buffer, options), { retries: 3, label: "cloudinaryUpload" });

module.exports = { uploadToCloudinary };