// utils/appError.js
class AppError extends Error {
  constructor(message, statusCode, { fieldErrors, code } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    if (code) this.code = code;
    if (fieldErrors) this.fieldErrors = fieldErrors;

    Error.captureStackTrace?.(this, this.constructor);
  }
}

export default AppError;
