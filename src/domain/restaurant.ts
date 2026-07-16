import { z } from "zod";

export const normalizedRestaurantSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1).nullable(),
  website: z.url().nullable(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  hours: z.array(z.object({ day: z.string(), hours: z.string() })),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  reviews: z.array(
    z.object({
      author: z.string().nullable(),
      text: z.string(),
      rating: z.number().min(0).max(5).nullable(),
    }),
  ),
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
