// backend/middleware/upload.middleware.js
const multer = require("multer");

// Memory storage — file never touches disk
// Buffer is streamed directly to Cloudinary
const storage = multer.memoryStorage();

//  Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // PDF
  "application/pdf",
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  // Word documents
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text
  "text/plain",
]);

//  Readable file type label for UI
const getFileType = (mimetype) => {
  if (mimetype === "application/pdf")                    return "pdf";
  if (mimetype.startsWith("image/"))                     return "image";
  if (mimetype.includes("word"))                         return "doc";
  if (mimetype.includes("presentation"))                 return "ppt";
  if (mimetype.includes("excel") || mimetype.includes("spreadsheet")) return "excel";
  if (mimetype === "text/plain")                         return "txt";
  return "other";
};

// File filter — reject unsupported types immediately
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type not allowed. Supported: PDF, Images, Word, PowerPoint, Excel, Text`
      ),
      false
    );
  }
};

// Multer instance — 10MB limit
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = { upload, getFileType };