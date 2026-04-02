/**
 * app/utils/errorHandler.js
 *
 * Global Express error-handling middleware.
 * Must be the LAST middleware registered in server.js (after all routes).
 * Express identifies it as an error handler because it has 4 arguments.
 */

/**
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const errorHandler = (err, req, res, next) => {
  // Log the full error internally (visible in your terminal)
  console.error(`\n🔴  Unhandled Error [${req.method} ${req.path}]:`);
  console.error(err.stack || err.message);

  const statusCode = err.status || err.statusCode || 500;
  const message =
    statusCode === 500
      ? "An internal server error occurred. Please try again."
      : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
