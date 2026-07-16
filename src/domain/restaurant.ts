import { z } from "zod";

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const hoursSchema = z.array(z.object({ day: z.string(), hours: z.string() }));
const reviewsSchema = z.array(
  z.object({
    author: z.string().nullable(),
    text: z.string(),
    rating: z.number().min(0).max(5).nullable(),
  }),
);

export const normalizedRestaurantSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1).nullable(),
  website: z.url().nullable(),
  location: locationSchema,
  hours: hoursSchema,
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  reviews: reviewsSchema,
  attribution: z.literal("Google Maps"),
  mapsUrl: z.url(),
  source: z.enum(["google-maps-preview", "apify-google-maps"]),
  diagnostics: z.object({
    provider: z.string(),
    warnings: z.array(z.string()),
  }),
  importedAt: z.iso.datetime(),
});

export type NormalizedRestaurant = z.infer<typeof normalizedRestaurantSchema>;

// Published records predate the live-provider fields and remain immutable.
export const storedRestaurantSchema = normalizedRestaurantSchema.extend({
  website: z.url().nullable().default(null),
  location: locationSchema.nullable().default(null),
  hours: hoursSchema.default([]),
  reviews: reviewsSchema.default([]),
  attribution: z.literal("Google Maps").default("Google Maps"),
  source: z
    .enum(["google-maps-preview", "apify-google-maps"])
    .default("google-maps-preview"),
  diagnostics: z
    .object({ provider: z.string(), warnings: z.array(z.string()) })
    .default({ provider: "legacy", warnings: [] }),
});

export type StoredRestaurant = z.infer<typeof storedRestaurantSchema>;
