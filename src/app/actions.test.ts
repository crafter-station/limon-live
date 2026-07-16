import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationFailedError } from "@/domain/generation/coordinator";
import {
  MapsUrlResolutionError,
  UnsupportedMapsUrlError,
} from "@/domain/generation/maps-url";
import { INITIAL_SUBMISSION_STATE } from "@/domain/generation/submission-form";

const mocks = vi.hoisted(() => ({
  advance: vi.fn(),
  consumeSubmissionLimit: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
  submit: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/server/generation-service", () => ({
  consumeSubmissionLimit: mocks.consumeSubmissionLimit,
  createGenerationCoordinator: () => ({
    advance: mocks.advance,
    submit: mocks.submit,
  }),
}));

import { advanceGeneration, submitGeneration } from "./actions";

describe("generation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeSubmissionLimit.mockResolvedValue(true);
    mocks.headers.mockResolvedValue(
      new Headers({ "x-vercel-forwarded-for": "203.0.113.8" }),
    );
  });

  it("redirects a pending submission to its generation", async () => {
    mocks.submit.mockResolvedValue({ kind: "generation", id: "generation-id" });
    const formData = new FormData();
    formData.set("sourceUrl", "https://example.com/maps");

    await expect(
      submitGeneration(INITIAL_SUBMISSION_STATE, formData),
    ).rejects.toThrow("redirect:/generate/generation-id");
    expect(mocks.consumeSubmissionLimit).toHaveBeenCalledWith("203.0.113.8");
  });

  it("redirects a ready duplicate to its stored slug", async () => {
    mocks.submit.mockResolvedValue({ kind: "ready", slug: "las-palmeras" });
    const formData = new FormData();
    formData.set("sourceUrl", "https://example.com/maps");

    await expect(
      submitGeneration(INITIAL_SUBMISSION_STATE, formData),
    ).rejects.toThrow("redirect:/r/las-palmeras");
  });

  it("preserves unsupported submissions with an accessible error", async () => {
    mocks.submit.mockRejectedValue(new UnsupportedMapsUrlError());
    const formData = new FormData();
    formData.set("sourceUrl", "not supported");

    await expect(
      submitGeneration(INITIAL_SUBMISSION_STATE, formData),
    ).resolves.toEqual({
      sourceUrl: "not supported",
      error: expect.stringContaining("supported HTTPS Google Maps"),
    });
  });

  it("preserves short links when resolution fails", async () => {
    mocks.submit.mockRejectedValue(new MapsUrlResolutionError());
    const formData = new FormData();
    formData.set("sourceUrl", "https://maps.app.goo.gl/example");

    await expect(
      submitGeneration(INITIAL_SUBMISSION_STATE, formData),
    ).resolves.toEqual({
      sourceUrl: "https://maps.app.goo.gl/example",
      error: expect.stringContaining("short link"),
    });
  });

  it("rejects empty and rate-limited submissions without starting work", async () => {
    const empty = new FormData();
    empty.set("sourceUrl", "  ");
    await expect(
      submitGeneration(INITIAL_SUBMISSION_STATE, empty),
    ).resolves.toEqual({
      sourceUrl: "  ",
      error: "Enter a Google Maps place link.",
    });
    expect(mocks.submit).not.toHaveBeenCalled();

    mocks.consumeSubmissionLimit.mockResolvedValue(false);
    const limited = new FormData();
    limited.set("sourceUrl", "https://www.google.com/maps/place/Cafe");
    await expect(
      submitGeneration(INITIAL_SUBMISSION_STATE, limited),
    ).resolves.toEqual({
      sourceUrl: "https://www.google.com/maps/place/Cafe",
      error: expect.stringContaining("Too many links"),
    });
    expect(mocks.submit).not.toHaveBeenCalled();
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
