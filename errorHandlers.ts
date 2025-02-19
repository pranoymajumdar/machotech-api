
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
export const tryCatch = 
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: "Validation error",
          details: error.errors
        });
        return;
      }
      
      console.error("API Error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("duplicate key")) {
          res.status(StatusCodes.CONFLICT).json({
            error: "Resource already exists"
          });
          return;
        }
      }
      
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: "Internal server error"
      });
    }
  };