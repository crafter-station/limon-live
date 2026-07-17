import { z } from "zod";

const decimalAmountSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/);

const extractedPriceSchema = z.object({
  label: z.string().min(1).max(60).nullable(),
  amount: decimalAmountSchema,
  visibleCurrency: z.enum(["PEN", "S/", "S/."]),
});

const extractedItemSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(500).nullable(),
  price: extractedPriceSchema.nullable(),
  variants: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        price: extractedPriceSchema,
      }),
    )
    .max(12),
  visibleText: z.string().min(1).max(1_500),
  sourceImage: z.number().int().nonnegative(),
});

export const menuExtractionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("no_menu"),
    reason: z.enum([
      "empty",
      "unreadable",
      "food_only",
      "people",
      "interior",
      "storefront",
      "not_menu",
    ]),
  }),
  z.object({
    kind: z.literal("menu"),
    sections: z
      .array(
        z.object({
          name: z.string().min(1).max(120).nullable(),
          items: z.array(extractedItemSchema).min(1).max(30),
        }),
      )
      .min(1)
      .max(12),
  }),
]);

const menuPriceSchema = z.object({
  label: z.string().nullable(),
  amount: decimalAmountSchema,
  currency: z.literal("PEN"),
});

export const menuSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string().nullable(),
      items: z.array(
        z.object({
          name: z.string(),
          description: z.string().nullable(),
          price: menuPriceSchema.nullable(),
          variants: z.array(
            z.object({ name: z.string(), price: menuPriceSchema }),
          ),
        }),
      ),
    }),
  ),
});

export type Menu = z.infer<typeof menuSchema>;
export type MenuExtraction = z.infer<typeof menuExtractionSchema>;

function isVisible(value: string | null, visibleText: string) {
  return value === null || visibleText.includes(value);
}

function hasVisiblePrice(
  price: z.infer<typeof extractedPriceSchema> | null,
  visibleText: string,
) {
  if (price === null) return true;

  const amount = price.amount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const amountToken = `(?<![\\p{L}\\p{N}_.,])${amount}(?![\\p{L}\\p{N}_.,])`;
  const currencyToken =
    price.visibleCurrency === "PEN"
      ? "(?<![\\p{L}\\p{N}_])PEN(?![\\p{L}\\p{N}_])"
      : price.visibleCurrency === "S/"
        ? "(?<![\\p{L}\\p{N}_])S\\/(?!\\.)"
        : "(?<![\\p{L}\\p{N}_])S\\/\\.(?![\\p{L}\\p{N}_])";

  return new RegExp(
    `(?:${currencyToken}\\s*${amountToken}|${amountToken}\\s*${currencyToken})`,
    "u",
  ).test(visibleText);
}

export function validateGroundedMenu(
  candidate: MenuExtraction,
  candidateCount: number,
): Menu | null {
  if (candidate.kind === "no_menu") return null;

  for (const section of candidate.sections) {
    if (
      section.name !== null &&
      !section.items.some((item) =>
        item.visibleText.includes(section.name ?? ""),
      )
    ) {
      return null;
    }
    for (const item of section.items) {
      if (
        item.sourceImage >= candidateCount ||
        !isVisible(item.name, item.visibleText) ||
        !isVisible(item.description, item.visibleText) ||
        !isVisible(item.price?.label ?? null, item.visibleText) ||
        !hasVisiblePrice(item.price, item.visibleText) ||
        item.variants.some(
          (variant) =>
            !isVisible(variant.name, item.visibleText) ||
            !isVisible(variant.price.label, item.visibleText) ||
            !hasVisiblePrice(variant.price, item.visibleText),
        )
      ) {
        return null;
      }
    }
  }

  return menuSchema.parse({
    sections: candidate.sections.map((section) => ({
      name: section.name,
      items: section.items.map(
        ({ visibleText: _, sourceImage: __, ...item }) => ({
          ...item,
          price: item.price ? { ...item.price, currency: "PEN" } : null,
          variants: item.variants.map((variant) => ({
            ...variant,
            price: { ...variant.price, currency: "PEN" },
          })),
        }),
      ),
    })),
  });
}
