// utils/cloudinaryUpload.js
const { cloudinary } = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadToCloudinary = (buffer, options) =>
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

module.exports = { uploadToCloudinary };