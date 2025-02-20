import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { eq, sql, inArray } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { type Request, type Response, type NextFunction } from "express";
import { db } from "../db";
import { product, category } from "../db/schema";
import { tryCatch } from "../errorHandlers";
import { validateRequest } from "../middlewares/validate.middleware";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const IMAGE_URL_PREFIX = "/uploads/products";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    const productUploadsDir = path.join(UPLOAD_DIR, "products");
    if (!fs.existsSync(productUploadsDir)) {
      fs.mkdirSync(productUploadsDir, { recursive: true });
    }
    cb(null, productUploadsDir);
  },
  filename: (_, file, cb) => {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 5 * 1024 * 1024,
    files: 10
  },
  fileFilter: (_, file, cb) => {
    if (!file) {
      return cb(null, true);
    }
    
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(null, false);
  },
}).array('images', 10);

const productBaseSchema = {
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.string().optional(),
  isContactForPrice: z.boolean().optional(),
  machineData: z.unknown(),
  showInHero: z.boolean(),
  heroIndex: z.number(),
  categoryIds: z.array(z.number()).optional()
};

export const productSchema = z.object({
  ...productBaseSchema,
  imageUrl: z.string().url("Invalid image URL").optional(),
});

export const productIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const router = Router();

router.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          error: `Unknown error: ${err.message}`
        });
      }
      next();
    });
  },
  tryCatch(async (req: Request, res: Response) => {
    const { 
      name, 
      description, 
      price, 
      isContactForPrice, 
      showInHero, 
      heroIndex, 
      machineData,
      categoryIds 
    } = req.body;

    if (!name || !description) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Name and description are required",
      });
      return;
    }

    let imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      imageUrls = (req.files as Express.Multer.File[]).map(
        file => `${IMAGE_URL_PREFIX}/${file.filename}`
      );
    }

    let parsedMachineData = {};
    try {
      parsedMachineData = machineData ? JSON.parse(machineData) : {};
    } catch (error) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid machine data format",
      });
      return;
    }

    let parsedCategoryIds: number[] = [];
    try {
      parsedCategoryIds = categoryIds ? 
        (Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds))
          .map(Number)
          .filter((id: number) => !isNaN(id)) : 
        [];
    } catch (error) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid category IDs format",
      });
      return;
    }

    const [newProduct] = await db
      .insert(product)
      .values({
        name,
        description,
        price: price || null,
        isContactForPrice: isContactForPrice === 'true' || isContactForPrice === true || false,
        machineData: {
          ...parsedMachineData,
          images: imageUrls,
          categories: parsedCategoryIds
        },
        showInHero: showInHero === 'true' || showInHero === true || false,
        heroIndex: Number(heroIndex) || 0
      })
      .returning();

    res.status(StatusCodes.CREATED).json(newProduct);
  })
);

router.get(
  "/",
  tryCatch(async (_, res: Response) => {
    const allProducts = await db.select().from(product);
    const categories = await db.select().from(category);
    
    const productsWithCategories = allProducts.map(prod => {
      const machineData = prod.machineData as { categories?: number[] } || {};
      const productCategories = categories.filter(cat => 
        machineData.categories?.includes(cat.id)
      );
      
      return {
        ...prod,
        categories: productCategories
      };
    });

    res.status(StatusCodes.OK).json(productsWithCategories);
  })
);

router.get(
  "/:id",
  tryCatch(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid product ID format",
      });
      return;
    }

    const foundProduct = await db
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    if (foundProduct.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "Product not found",
      });
      return;
    }

    const machineData = foundProduct[0].machineData as { categories?: number[] } || {};
    let productCategories: { id: number; name: string }[] = [];
    
    if (machineData.categories?.length) {
      productCategories = await db
        .select()
        .from(category)
        .where(inArray(category.id, machineData.categories));
    }

    const productWithCategories = {
      ...foundProduct[0],
      categories: productCategories
    };

    res.status(StatusCodes.OK).json(productWithCategories);
  })
);

router.put(
  "/:id",
  (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          error: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          error: `Unknown error: ${err.message}`
        });
      }
      next();
    });
  },
  tryCatch(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { 
      name, 
      description, 
      price, 
      isContactForPrice, 
      showInHero, 
      heroIndex, 
      machineData,
      categoryIds 
    } = req.body;

    if (isNaN(id)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Invalid product ID format",
      });
      return;
    }

    const existingProduct = await db
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    if (existingProduct.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "Product not found",
      });
      return;
    }

    let parsedMachineData;
    if (machineData !== undefined) {
      try {
        parsedMachineData = JSON.parse(machineData);
      } catch (error) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid machine data format",
        });
        return;
      }
    }

    let parsedCategoryIds: number[] | undefined;
    if (categoryIds !== undefined) {
      try {
        parsedCategoryIds = (Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds))
          .map(Number)
          .filter((id: number) => !isNaN(id));
      } catch (error) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: "Invalid category IDs format",
        });
        return;
      }
    }

    let updateData: Partial<(typeof existingProduct)[0]> = {};

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (isContactForPrice !== undefined) updateData.isContactForPrice = isContactForPrice;
    if (showInHero !== undefined) updateData.showInHero = showInHero;
    if (heroIndex !== undefined) updateData.heroIndex = heroIndex;
    if (parsedMachineData !== undefined || parsedCategoryIds !== undefined) {
      const existingMachineData = existingProduct[0].machineData || {};
      updateData.machineData = {
        ...existingMachineData,
        ...parsedMachineData,
        ...(parsedCategoryIds !== undefined && { categories: parsedCategoryIds })
      };
    }

    const [updatedProduct] = await db
      .update(product)
      .set(updateData)
      .where(eq(product.id, id))
      .returning();

    res.status(StatusCodes.OK).json(updatedProduct);
  })
);

router.delete(
  "/:id",
  validateRequest({ params: productIdSchema }),
  tryCatch(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    const foundProduct = await db
      .select()
      .from(product)
      .where(eq(product.id, id))
      .limit(1);

    if (foundProduct.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        error: "Product not found",
      });
      return;
    }

    await db.delete(product).where(eq(product.id, id));

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Successfully deleted '${foundProduct[0].name}'`
    });
  })
);

export { router as productsRouter };