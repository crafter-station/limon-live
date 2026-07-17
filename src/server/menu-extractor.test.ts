import { describe, expect, it, vi } from "vitest";
import {
  MENU_CANDIDATE_LIMIT,
  MENU_CONCURRENCY,
  MENU_MAX_OUTPUT_TOKENS,
  MENU_MAX_RETRIES,
  MENU_MODEL_ID,
  MENU_TIMEOUT_MS,
  MenuExtractor,
} from "./menu-extractor";

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
    expect(JSON.stringify(execute.mock.calls[0][0])).not.toContain("review");
    expect(JSON.stringify(execute.mock.calls[0][0])).not.toContain("avatar");
  });

  it("keeps model, timeout, retries, output, and concurrency as bounded server constants", () => {
    expect(MENU_MODEL_ID).toBe("google/gemini-2.5-flash-lite");
    expect(MENU_TIMEOUT_MS).toBeGreaterThan(0);
    expect(MENU_MAX_RETRIES).toBe(1);
    expect(MENU_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(1_800);
    expect(MENU_CONCURRENCY).toBe(2);
  });

  it("bounds concurrent fake executions", async () => {
    let active = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const extractor = new MenuExtractor(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return { kind: "no_menu", reason: "not_menu" };
    });
    const pending = Array.from({ length: 4 }, (_, index) =>
      extractor.extract([photo(index)]),
    );
    await vi.waitFor(() => expect(active).toBe(MENU_CONCURRENCY));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases.length).toBe(2));
    releases.splice(0).forEach((release) => release());
    await Promise.all(pending);
    expect(peak).toBe(MENU_CONCURRENCY);
  });

  it("retries one transient fake failure", async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({ kind: "no_menu", reason: "unreadable" });
    const extractor = new MenuExtractor(execute, {
      timeoutMs: 100,
      maxRetries: 1,
    });
    await expect(extractor.extract([photo(0)])).resolves.toBeNull();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("aborts delayed fake attempts at the timeout bound", async () => {
    const execute = vi.fn(
      async (
        _photos: readonly ReturnType<typeof photo>[],
        signal: AbortSignal,
      ) =>
        new Promise<never>((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        ),
    );
    const extractor = new MenuExtractor(execute, {
      timeoutMs: 5,
      maxRetries: 1,
    });
    await expect(extractor.extract([photo(0)])).rejects.toThrow("timed out");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.every((call) => call[1].aborted)).toBe(true);
  });
});
