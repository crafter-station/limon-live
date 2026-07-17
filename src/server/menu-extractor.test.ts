import { describe, expect, it, vi } from "vitest";
import { MENU_CANDIDATE_LIMIT, MenuExtractor } from "./menu-extractor";

const photo = (
  index: number,
): { url: string; alt: string; attribution: string | null } => ({
  url: `https://store.public.blob.vercel-storage.com/${index}.jpg`,
  alt: `Place photo ${index}`,
  attribution: null,
});

describe("MenuExtractor", () => {
  it("does not call AI without safe retained photos and caps exact candidates", async () => {
    const execute = vi.fn(
      async (_photos: readonly ReturnType<typeof photo>[]) => ({
        kind: "no_menu" as const,
        reason: "not_menu" as const,
      }),
    );
    const extractor = new MenuExtractor(execute);
    await expect(extractor.extract([])).resolves.toBeNull();
    await extractor.extract(
      Array.from({ length: 8 }, (_, index) => photo(index)),
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toEqual(
      Array.from({ length: MENU_CANDIDATE_LIMIT }, (_, index) => photo(index)),
    );
  });
});
