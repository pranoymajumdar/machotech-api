import { type Request, type Response, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

interface JWTPayload {
  userId: number;
  username: string;
}

export const generateToken = (userId: number, username: string) => {
  return jwt.sign({ userId, username } as JWTPayload, JWT_SECRET, { expiresIn: "24h" });
};

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      error: "Authentication required",
    });
    return;
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = user;
    next();
  } catch (error) {
    res.status(StatusCodes.FORBIDDEN).json({
      error: "Invalid or expired token",
    });
    return;
  }
}; 