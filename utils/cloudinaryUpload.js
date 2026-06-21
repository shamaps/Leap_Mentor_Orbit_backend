const { cloudinary } = require("../config/cloudinary");
const streamifier = require("streamifier");
const { withRetry } = require("./withRetry");

const attemptUpload = (buffer, options) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            options,
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