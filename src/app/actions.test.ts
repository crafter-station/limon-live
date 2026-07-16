import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationFailedError } from "@/domain/generation/coordinator";
import { UnsupportedFixtureUrlError } from "@/domain/generation/fixture-provider";

const mocks = vi.hoisted(() => ({
  advance: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
  submit: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/generation-service", () => ({
  createGenerationCoordinator: () => ({
    advance: mocks.advance,
    submit: mocks.submit,
  }),
}));

import { advanceGeneration, submitGeneration } from "./actions";

describe("generation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a pending submission to its generation", async () => {
    mocks.submit.mockResolvedValue({ kind: "generation", id: "generation-id" });
    const formData = new FormData();
    formData.set("sourceUrl", "https://example.com/maps");

    await expect(submitGeneration(formData)).rejects.toThrow(
      "redirect:/generate/generation-id",
    );
  });

  it("redirects a ready duplicate to its stored slug", async () => {
    mocks.submit.mockResolvedValue({ kind: "ready", slug: "las-palmeras" });
    const formData = new FormData();
    formData.set("sourceUrl", "https://example.com/maps");

    await expect(submitGeneration(formData)).rejects.toThrow(
      "redirect:/r/las-palmeras",
    );
  });

  it("redirects unsupported submissions back with safe input", async () => {
    mocks.submit.mockRejectedValue(new UnsupportedFixtureUrlError());
    const formData = new FormData();
    formData.set("sourceUrl", "not supported");

    await expect(submitGeneration(formData)).rejects.toThrow(
      "redirect:/?error=unsupported-url&sourceUrl=not%20supported",
    );
  });

  it("redirects a published advance to its stored slug", async () => {
    mocks.advance.mockResolvedValue({ kind: "ready", slug: "las-palmeras" });
    const formData = new FormData();
    formData.set("id", "00000000-0000-4000-8000-000000000001");

    await expect(advanceGeneration(formData)).rejects.toThrow(
      "redirect:/r/las-palmeras",
    );
  });

  it("redirects a failed advance back to its generation", async () => {
    mocks.advance.mockRejectedValue(new GenerationFailedError());
    const formData = new FormData();
    formData.set("id", "00000000-0000-4000-8000-000000000001");

    await expect(advanceGeneration(formData)).rejects.toThrow(
      "redirect:/generate/00000000-0000-4000-8000-000000000001",
    );
  });
});
