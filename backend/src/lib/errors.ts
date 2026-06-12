export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'APP_ERROR',
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new AppError(400, msg, 'BAD_REQUEST');
export const unauthorized = (msg = 'Unauthorized') => new AppError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Forbidden') => new AppError(403, msg, 'FORBIDDEN');
export const notFound = (msg = 'Not found') => new AppError(404, msg, 'NOT_FOUND');
export const conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');
