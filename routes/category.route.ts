import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { eq } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { type Request, type Response } from "express";
import { db } from "../db";
import { category } from "../db/schema";
import { tryCatch } from "../errorHandlers";
import { validateRequest } from "../middlewares/category.middleware";

// Constants
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const IMAGE_URL_PREFIX = "/uploads/categories";

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    const categoryUploadsDir = path.join(UPLOAD_DIR, "categories");
    if (!fs.existsSync(categoryUploadsDir)) {
      fs.mkdirSync(categoryUploadsDir, { recursive: true });
    }
    cb(null, categoryUploadsDir);
  },
  filename: (_, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
  },
});

// Schema Definitions
const categoryBaseSchema = {
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters"),
};

export const categorySchema = z.object({
  ...categoryBaseSchema,
  imageUrl: z.string().url("Invalid image URL").optional(),
});

export const categoryIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

// Router Setup
const router = Router();

// Create a new category
router.post(
  "/",
  upload.single("image"),
  tryCatch(async (req: Request, res: Response) => {
    const { name, description } = req.body;

    // Validate required fields
    if (!name || !description) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Name and description are required",
      });
      return;
    }

    // Check if category already exists
    const existingCategory = await db
      .select()
      .from(category)
      .where(eq(category.name, name))
      .limit(1);

    if (existingCategory.length > 0) {
      res
        .status(StatusCodes.CONFLICT)
        .json({ error: "Category already exists" });
      return;
    }

    // Process image if uploaded
    let imageUrl = null;
    if (req.file) {
      imageUrl = `${IMAGE_URL_PREFIX}/${req.file.filename}`;
    }

    // Create new category
    const [newCategory] = await db
      .insert(category)
      .values({
        name,
        description,
        imageUrl,
      })
      .returning();

    res.status(StatusCodes.CREATED).json(newCategory);
  })
);

// Get all categories
router.get(
  "/",
  tryCatch(async (_, res: Response) => {
    const categories = await db.select().from(category);
    res.status(StatusCodes.OK).json(categories);
  })
);

// Get category by ID
router.get(
  "/:id",
  tryCatch(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid category ID format",
      });
      return;
    }

    const foundCategory = await db
      .select()
      .from(category)
      .where(eq(category.id, id))
      .limit(1);

    if (foundCategory.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "Category not found",
      });
      return;
    }

    res.status(StatusCodes.OK).json(foundCategory[0]);
  })
);

// Update category
router.put(
  "/:id",
  upload.single("image"),
  tryCatch(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { name, description } = req.body;

    if (isNaN(id)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid category ID format",
      });
      return;
    }

    // Check if category exists
    const existingCategory = await db
      .select()
      .from(category)
      .where(eq(category.id, id))
      .limit(1);

    if (existingCategory.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "Category not found",
      });
      return;
    }

    // Handle image update if present
    let updateData: Partial<(typeof existingCategory)[0]> = {};

    if (name) updateData.name = name;
    if (description) updateData.description = description;

    if (req.file) {
      // Delete old image if exists
      if (existingCategory[0].imageUrl) {
        try {
          const oldImagePath = path.join(
            process.cwd(),
            existingCategory[0].imageUrl.replace(/^\//, "")
          );
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        } catch (error) {
          console.error("Error deleting old image:", error);
        }
      }

      updateData.imageUrl = `${IMAGE_URL_PREFIX}/${req.file.filename}`;
    }

    // Update category
    const [updatedCategory] = await db
      .update(category)
      .set(updateData)
      .where(eq(category.id, id))
      .returning();

    res.status(StatusCodes.OK).json(updatedCategory);
  })
);

// Delete category
router.delete(
  "/:id",
  validateRequest({ params: categoryIdSchema }),
  tryCatch(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    const foundCategory = await db
      .select()
      .from(category)
      .where(eq(category.id, id))
      .limit(1);

    if (foundCategory.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "Category not found",
      });
      return;
    }

    // Delete associated image if exists
    if (foundCategory[0].imageUrl) {
      try {
        const imagePath = path.join(
          process.cwd(),
          foundCategory[0].imageUrl.replace(/^\//, "")
        );
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      } catch (error) {
        console.error("Error deleting category image:", error);
      }
    }

    // Delete the category
    await db.delete(category).where(eq(category.id, id));

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Successfully deleted '${foundCategory[0].name}'`,
    });
  })
);

export { router as categoriesRouter };
