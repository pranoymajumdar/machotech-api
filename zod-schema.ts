import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(3, "Name is required").max(100),
  description: z.string().min(10, "Description is required"),
  imageUrl: z.string().url("Invalid image URL").optional(),
});

export const productSchema = z.object({
  name: z.string().max(100),
  price: z.string().optional(),
  isContactForPrice: z.boolean().default(true),
  description: z.string().min(1),
  machineData: z.record(z.any()),
  showInHero: z.boolean(),
  heroIndex: z.number().int().default(0),
});

export const updateProductSchema = productSchema.partial().extend({
  id: z.number(),
});

export const productIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const categoryIdSchema = categorySchema.partial().extend({
  id: z.number(),
});

export const categoryDeleteSchema = z.object({
  id: z.number(),
});
