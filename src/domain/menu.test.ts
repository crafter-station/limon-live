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
          visibleText:
            "Ceviches Ceviche clásico Personal S/ 29.90 Fuente PEN 49",
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

  it("rejects an invented section name", () => {
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({
          ...valid,
          sections: [{ ...valid.sections[0], name: "Especiales inventados" }],
        }),
        1,
      ),
    ).toBeNull();
  });

  it("rejects an item price whose currency is not visibly grounded", () => {
    const item = valid.sections[0].items[0];
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({
          ...valid,
          sections: [
            {
              ...valid.sections[0],
              items: [
                {
                  ...item,
                  visibleText: item.visibleText.replace("S/ ", ""),
                },
              ],
            },
          ],
        }),
        1,
      ),
    ).toBeNull();
  });

  it("rejects a variant price with invented currency evidence", () => {
    const item = valid.sections[0].items[0];
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({
          ...valid,
          sections: [
            {
              ...valid.sections[0],
              items: [
                {
                  ...item,
                  variants: [
                    {
                      ...item.variants[0],
                      price: {
                        ...item.variants[0].price,
                        visibleCurrency: "S/.",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
        1,
      ),
    ).toBeNull();
  });

  it("rejects PEN inside an item name as item-price currency evidence", () => {
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({
          kind: "menu",
          sections: [
            {
              name: null,
              items: [
                {
                  name: "PENNE",
                  description: null,
                  price: {
                    label: null,
                    amount: "20",
                    visibleCurrency: "PEN",
                  },
                  variants: [],
                  visibleText: "PENNE 20",
                  sourceImage: 0,
                },
              ],
            },
          ],
        }),
        1,
      ),
    ).toBeNull();
  });

  it("rejects PEN inside a variant name as variant-price currency evidence", () => {
    expect(
      validateGroundedMenu(
        menuExtractionSchema.parse({
          kind: "menu",
          sections: [
            {
              name: null,
              items: [
                {
                  name: "Pasta",
                  description: null,
                  price: null,
                  variants: [
                    {
                      name: "PENNE",
                      price: {
                        label: null,
                        amount: "20",
                        visibleCurrency: "PEN",
                      },
                    },
                  ],
                  visibleText: "Pasta PENNE 20",
                  sourceImage: 0,
                },
              ],
            },
          ],
        }),
        1,
      ),
    ).toBeNull();
  });

  it.each(["PEN", "S/", "S/."] as const)(
    "accepts a visible %s item-price marker",
    (visibleCurrency) => {
      expect(
        validateGroundedMenu(
          menuExtractionSchema.parse({
            kind: "menu",
            sections: [
              {
                name: null,
                items: [
                  {
                    name: "Pasta",
                    description: null,
                    price: {
                      label: null,
                      amount: "20",
                      visibleCurrency,
                    },
                    variants: [],
                    visibleText: `Pasta ${visibleCurrency} 20`,
                    sourceImage: 0,
                  },
                ],
              },
            ],
          }),
          1,
        ),
      ).not.toBeNull();
    },
  );

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
