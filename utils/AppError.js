// utils/AppError.js
class AppError extends Error {
  constructor(status, message) {  // ← swap the parameter order here
    super(message);
    this.status = status;
    this.message = message;
    this.name = "AppError";
  }
}

module.exports = AppError;