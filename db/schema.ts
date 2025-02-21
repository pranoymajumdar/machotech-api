import {
    boolean,
    integer,
    jsonb,
    numeric,
    pgTable,
    primaryKey,
    text,
    timestamp,
    varchar,
  } from "drizzle-orm/pg-core";
  
  export const users = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    username: varchar("username", { length: 100 }).unique().notNull(),
    password: text("password").notNull(),
  });
  
  export const product = pgTable("product", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    price: numeric("price"),
    isContactForPrice: boolean("is_contact_for_price").default(true),
    description: text("description").notNull(),
    machineData: jsonb("machine_data").notNull(),
    showInHero: boolean("show_in_hero").notNull(),
    heroIndex: integer("hero_index").notNull().default(0),
  });
  
  export const productImages = pgTable("product_images", {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId: integer("product_id")
      .references(() => product.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  });
  
  
  
  export const category = pgTable("category", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 300 }).notNull(),
    imageUrl: varchar().default(""),
  });
  
  export const productCategory = pgTable(
    "product_category",
    {
      productId: integer("product_id")
        .notNull()
        .references(() => product.id),
      categoryId: integer("category_id")
        .notNull()
        .references(() => category.id),
    },
    (table) => [primaryKey({ columns: [table.productId, table.categoryId] })]
  );
  