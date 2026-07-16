// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationProgress } from "./generation-progress";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GenerationProgress", () => {
  it("advances once, polls, and redirects when persisted state is ready", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "generating", slug: null, error: null }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ready",
            slug: "las-palmeras",
            error: null,
          }),
        ),
      );
    const navigate = vi.fn();

    render(
      <GenerationProgress
        id="id"
        initialStatus={{ status: "pending", slug: null, error: null }}
        navigate={navigate}
      />,
    );
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(1_500));

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(navigate).toHaveBeenCalledWith("/r/las-palmeras");
  });

  it("offers recovery actions for failures", () => {
    render(
      <GenerationProgress
        id="id"
        initialStatus={{ status: "failed", slug: null, error: "Safe error" }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Safe error");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "Use another link" }),
    ).toHaveLength(1);
  });

  it("stops polling with a resumable delayed state", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ status: "generating", slug: null, error: null }),
      ),
    );
    render(
      <GenerationProgress
        id="id"
        initialStatus={{ status: "generating", slug: null, error: null }}
      />,
    );
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByText("This is taking longer than usual.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
  });
});
