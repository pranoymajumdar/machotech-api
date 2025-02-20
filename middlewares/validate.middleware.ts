import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { type AnyZodObject, z } from "zod";

type ValidationSchema = {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
};

export const validateRequest = (schemas: ValidationSchema) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }

      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: "Validation error",
          details: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
          })),
        });
        return;
      }

      next(error);
    }
  };
};


export const validateCategoryRequest = validateRequest;
