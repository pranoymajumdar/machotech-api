import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { type Request, type Response } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { tryCatch } from "../errorHandlers";
import { generateToken } from "../middlewares/auth.middleware";

const router = Router();

const authSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// router.post(
//   "/register",
//   tryCatch(async (req: Request, res: Response): Promise<void> => {
//     const { username, password } = authSchema.parse(req.body);

//     const existingUser = await db
//       .select()
//       .from(users)
//       .where(eq(users.username, username))
//       .limit(1);

//     if (existingUser.length > 0) {
//       res.status(StatusCodes.CONFLICT).json({
//         error: "Username already exists",
//       });
//       return;
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const [newUser] = await db
//       .insert(users)
//       .values({
//         username,
//         password: hashedPassword,
//       })
//       .returning();

//     const token = generateToken(newUser.id, newUser.username);

//     res.status(StatusCodes.CREATED).json({
//       token,
//       user: {
//         id: newUser.id,
//         username: newUser.username,
//       },
//     });
//   })
// );

router.post(
  "/login",
  tryCatch(async (req: Request, res: Response): Promise<void> => {
    const { username, password } = authSchema.parse(req.body);

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length === 0) {
       res.status(StatusCodes.UNAUTHORIZED).json({
        error: "Invalid credentials",
      });
      return;
    }

    const validPassword = await bcrypt.compare(
      password,
      existingUser[0].password
    );

    if (!validPassword) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        error: "Invalid credentials",
      });
      return;
    }

    const token = generateToken(existingUser[0].id, existingUser[0].username);

    res.status(StatusCodes.OK).json({
      token,
      user: {
        id: existingUser[0].id,
        username: existingUser[0].username,
      },
    });
  })
);

export { router as authRouter }; 