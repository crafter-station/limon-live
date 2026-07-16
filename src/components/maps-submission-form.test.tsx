import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  submitGeneration: vi.fn(),
}));

import { MapsSubmissionForm } from "./maps-submission-form";

describe("Maps submission form", () => {
  it("uses keyboard-operable controls and exposes accessible error hooks", () => {
    const html = renderToStaticMarkup(<MapsSubmissionForm />);

    expect(html).toContain('<label for="sourceUrl">');
    expect(html).toContain('name="sourceUrl"');
    expect(html).toContain('required=""');
    expect(html).toContain('aria-describedby="source-note"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('type="button"');
    expect(html).toContain("Try the Las Palmeras example");
  });
});
