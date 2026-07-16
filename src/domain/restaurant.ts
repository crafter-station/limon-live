import { z } from "zod";

export const normalizedRestaurantSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  phone: z.string().min(1).nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  mapsUrl: z.url(),
  importedAt: z.iso.datetime(),
});

export type NormalizedRestaurant = z.infer<typeof normalizedRestaurantSchema>;
