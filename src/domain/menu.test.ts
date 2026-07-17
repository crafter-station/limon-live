import { describe, expect, it } from "vitest";
import { menuExtractionSchema, validateGroundedMenu } from "./menu";

const valid = {
  kind: "menu" as const,
  sections: [
    {
      name: "Ceviches",
      items: [
        {
          name: "Ceviche clásico",
          description: null,
          price: {
            label: "Personal",
            amount: "29.90",
            visibleCurrency: "S/" as const,
          },
          variants: [
            {
              name: "Fuente",
              price: {
                label: null,
                amount: "49",
                visibleCurrency: "PEN" as const,
              },
            },
          ],
          visibleText: "Ceviche clásico Personal S/ 29.90 Fuente PEN 49",
          sourceImage: 0,
        },
      ],
    },
  ],
};

describe("menu validation", () => {
  it("keeps nullable fields and variants while normalizing visible soles to PEN", () => {
    expect(validateGroundedMenu(menuExtractionSchema.parse(valid), 1)).toEqual({
      sections: [
        {
          name: "Ceviches",
          items: [
            {
              name: "Ceviche clásico",
              description: null,
              price: { label: "Personal", amount: "29.90", currency: "PEN" },
              variants: [
                {
                  name: "Fuente",
                  price: { label: null, amount: "49", currency: "PEN" },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it.each(["12.345", "1e2", "-4", "01", "12,50"])(
    "rejects malformed decimal amount %s",
    (amount) => {
      expect(() =>
        menuExtractionSchema.parse({
          ...valid,
          sections: [
            {
              ...valid.sections[0],
              items: [
                {
                  ...valid.sections[0].items[0],
                  price: { ...valid.sections[0].items[0].price, amount },
                },
              ],
            },
          ],
        }),
      ).toThrow();
    },
  );

  it("rejects invented text and out-of-range source images", () => {
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({
          ...valid,
          sections: [
            {
              ...valid.sections[0],
              items: [{ ...valid.sections[0].items[0], name: "Inventado" }],
            },
          ],
        }),
        1,
      ),
    ).toBeNull();
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({
          ...valid,
          sections: [
            {
              ...valid.sections[0],
              items: [{ ...valid.sections[0].items[0], sourceImage: 1 }],
            },
          ],
        }),
        1,
      ),
    ).toBeNull();
  });

  it.each([
    "empty",
    "unreadable",
    "food_only",
    "people",
    "interior",
    "storefront",
    "not_menu",
  ])("publishes nothing for %s", (reason) =>
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({ kind: "no_menu", reason }),
        1,
      ),
    ).toBeNull(),
  );
});
