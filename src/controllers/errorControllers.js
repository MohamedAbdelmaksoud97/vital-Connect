import AppError from "../utils/appError.js";

const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, req, res);
  } else {
    let error = err; // don't spread; keep mongo-specific props intact
    // Normalize known errors into AppError with fieldErrors for the client
    if (error.name === "CastError") error = handleCastErrorDB(error);
    else if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    else if (error.name === "ValidationError") error = handleValidationErrorDB(error);
    else if (error.name === "JsonWebTokenError") error = handleJWTError();
    else if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

const sendErrorDev = (err, req, res) => {
  const { statusCode, payload } = buildResponse(err);
  res.status(statusCode).json({
    ...payload,
    error: err,
    stack: err.stack,
  });
};

const handleCastErrorDB = (err) => {
  const appErr = new AppError(`Invalid ${err.path}: ${err.value}.`, 400);
  appErr.fieldErrors = { [err.path]: "Invalid value." };
  return appErr;
};

const handleDuplicateFieldsDB = (err) => {
  // Mongo duplicate key error: err.code === 11000, with err.keyValue like { email: "a@b.com" }
  const keyValue = err.keyValue || {};
  const fields = Object.keys(keyValue);

  const fieldErrors = {};
  for (const field of fields) {
    fieldErrors[field] =
      `Duplicate value '${keyValue[field]}' for ${field}. Please use another value.`;
  }

  const message =
    fields.length === 1
      ? `Duplicate value for '${fields[0]}' Please use another value.`
      : `Duplicate values for: ${fields.join(", ")}.`;

  const appErr = new AppError(message, 400, { code: "DUPLICATE_KEY" });
  appErr.fieldErrors = fieldErrors;
  return appErr;
};

const handleValidationErrorDB = (err) => {
  // err.errors = { field: ValidatorError, ... }
  const fieldErrors = {};
  for (const [path, valErr] of Object.entries(err.errors || {})) {
    fieldErrors[path] = valErr.message;
  }
  const appErr = new AppError("Invalid input data.", 400);
  appErr.fieldErrors = fieldErrors;
  return appErr;
};

const handleJWTError = () => new AppError("Invalid token. Please log in again!", 401);

const handleJWTExpiredError = () =>
  new AppError("Your token has expired! Please log in again.", 401);

/* ---------- helpers to shape responses ---------- */

const buildResponse = (err) => {
  const statusCode = err.statusCode || 500;
  const status = String(statusCode).startsWith("4") ? "fail" : "error";
  const payload = {
    status,
    message: err.message || "Something went wrong",
    code: err.code || "UNKNOWN_ERROR", // 👈 stable code for UI
  };
  if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
    payload.fieldErrors = err.fieldErrors;
  }
  return { statusCode, payload };
};

const sendErrorProd = (err, req, res) => {
  if (err.isOperational) {
    const { statusCode, payload } = buildResponse(err);
    return res.status(statusCode).json(payload);
  }
  // Unknown/unexpected: don't leak details
  console.error("ERROR 💥", err);
  return res.status(500).json({
    status: "error",
    message: "Something went very wrong!",
  });
};

/* ---------- Global error middleware ---------- */

export default globalErrorHandler;
