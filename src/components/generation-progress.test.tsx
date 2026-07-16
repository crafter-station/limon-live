// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationProgress } from "./generation-progress";

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
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
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(
      screen.getByText("Building your page").getAttribute("aria-current"),
    ).toBe("step");
    await act(async () => vi.advanceTimersByTimeAsync(1_500));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty("method");
    expect(navigate).toHaveBeenCalledWith("/r/las-palmeras");
  });

  it("presents persisted failures in English and retries them", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: "generating", slug: null, error: null }),
        ),
      );
    render(
      <GenerationProgress
        id="id"
        initialStatus={{
          status: "failed",
          slug: null,
          error: "No pudimos generar el sitio.",
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "We couldn't finish your site right now. Please try again.",
    );
    expect(screen.getByRole("alert").textContent).not.toContain("No pudimos");
    expect(
      screen.getAllByRole("link", { name: "Use another link" }),
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("stops polling with a resumable delayed state", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
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
    const requestCountAtTimeout = fetchMock.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(4_500));
    expect(fetchMock).toHaveBeenCalledTimes(requestCountAtTimeout);

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(requestCountAtTimeout + 1);
    expect(fetchMock.mock.lastCall?.[1]).toMatchObject({ method: "POST" });
  });

  it("stops after unmount and resumes after a refresh remount", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: "generating", slug: null, error: null }),
        ),
      );
    const initialStatus = {
      status: "generating" as const,
      slug: null,
      error: null,
    };
    const first = render(
      <GenerationProgress id="id" initialStatus={initialStatus} />,
    );
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual([
      "POST",
      undefined,
    ]);

    first.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(4_500));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    render(<GenerationProgress id="id" initialStatus={initialStatus} />);
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(1_500));
    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual([
      "POST",
      undefined,
      "POST",
      undefined,
    ]);
  });
});
