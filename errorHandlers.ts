import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Wraps an async request handler to catch and process errors
 */
export const tryCatch = (handler: AsyncRequestHandler) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error("API Error:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error",
      });
    }
  };
};