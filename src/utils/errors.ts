export interface AppError extends Error {
  statusCode: number;
  code: string;
}

export function createError(
  statusCode: number,
  code: string,
  message: string,
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function badRequest(code: string, message: string): AppError {
  return createError(400, code, message);
}

export function notFound(code: string, message: string): AppError {
  return createError(404, code, message);
}

export function internalServerError(
  message = "Internal server error",
): AppError {
  return createError(500, "INTERNAL_SERVER_ERROR", message);
}

export function unauthorized(message = "Authentication required."): AppError {
  return createError(401, "UNAUTHORIZED", message);
}

export function invalidCredentials(
  message = "Invalid email or password.",
): AppError {
  return createError(401, "INVALID_CREDENTIALS", message);
}

export function conflict(code: string, message: string): AppError {
  return createError(409, code, message);
}
