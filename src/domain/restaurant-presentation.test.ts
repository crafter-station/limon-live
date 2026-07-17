import { describe, expect, it } from "vitest";
import {
  openingStatus,
  safeWebsite,
  selectedReviews,
} from "./restaurant-presentation";

describe("restaurant presentation", () => {
  it("selects at most three usable reviews by recent date then provider order", () => {
    const review = (text: string, publishedAt?: string) => ({
      author: "A",
      text,
      rating: 5,
      publishedAt,
    });
    expect(
      selectedReviews([
        review("sin fecha"),
        review("antigua", "2026-01-01T00:00:00.000Z"),
        review("   ", "2026-07-01T00:00:00.000Z"),
        review("reciente", "2026-06-01T00:00:00.000Z"),
        review("otra"),
      ]).map(({ text }) => text),
    ).toEqual(["reciente", "antigua", "sin fecha"]);
  });

  it("uses Lima time with exact and overnight boundaries", () => {
    const hours = [
      { day: "viernes", hours: "18:00-02:00" },
      { day: "sábado", hours: "10:00-14:00" },
    ];
    expect(openingStatus(hours, new Date("2026-07-18T05:59:00Z"))).toBe(
      "Abierto ahora",
    );
    expect(openingStatus(hours, new Date("2026-07-18T07:00:00Z"))).toBe(
      "Cerrado ahora",
    );
    expect(openingStatus(hours, new Date("2026-07-18T15:00:00Z"))).toBe(
      "Abierto ahora",
    );
    expect(openingStatus(hours, new Date("2026-07-18T19:00:00Z"))).toBe(
      "Cerrado ahora",
    );
  });

  it("declines uncertain or malformed schedules and unsafe websites", () => {
    expect(
      openingStatus([{ day: "lunes", hours: "horario variable" }]),
    ).toBeNull();
    expect(openingStatus([{ day: "quizá", hours: "09:00-17:00" }])).toBeNull();
    expect(safeWebsite("javascript:alert(1)")).toBeNull();
    expect(safeWebsite("https://user:pass@example.com")).toBeNull();
    expect(safeWebsite("https://example.com/menu")).toBe(
      "https://example.com/menu",
    );
  });
});
