// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_MAPS_URL } from "@/domain/generation/fixture-provider";
import type { SubmissionFormState } from "@/domain/generation/submission-form";

const submitGeneration = vi.hoisted(() =>
  vi.fn<
    (
      state: SubmissionFormState,
      formData: FormData,
    ) => Promise<SubmissionFormState>
  >(),
);

vi.mock("@/app/actions", () => ({ submitGeneration }));

import { MapsSubmissionForm } from "./maps-submission-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Maps submission form", () => {
  it("fills the example with the keyboard without submitting", async () => {
    const user = userEvent.setup();
    render(<MapsSubmissionForm />);
    const input = screen.getByRole("textbox", {
      name: "Google Maps place link",
    }) as HTMLInputElement;
    const exampleButton = screen.getByRole("button", {
      name: "Try the Las Palmeras example",
    });

    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(exampleButton);
    await user.keyboard("{Enter}");

    expect(input.value).toBe(FIXTURE_MAPS_URL);
    expect(submitGeneration).not.toHaveBeenCalled();
  });

  it("submits with the keyboard and renders associated accessible errors", async () => {
    const user = userEvent.setup();
    const sourceUrl = "https://example.test/not-google";
    const error = "Enter a supported HTTPS Google Maps place link.";
    submitGeneration.mockResolvedValue({ sourceUrl, error });
    render(<MapsSubmissionForm />);
    const input = screen.getByRole("textbox", {
      name: "Google Maps place link",
    }) as HTMLInputElement;

    await user.type(input, sourceUrl);
    await user.keyboard("{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(error);
    expect(input.value).toBe(sourceUrl);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    await waitFor(() => {
      expect(submitGeneration).toHaveBeenCalledOnce();
      expect(submitGeneration.mock.calls[0]?.[1].get("sourceUrl")).toBe(
        sourceUrl,
      );
    });
  });
});
