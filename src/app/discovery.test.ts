import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("search discovery", () => {
  it("keeps generation and restaurant paths out of discovery", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/generate/", "/r/"] },
      sitemap: "https://limon.lat/sitemap.xml",
    });
    expect(sitemap()).toEqual([
      { url: "https://limon.lat/", changeFrequency: "monthly", priority: 1 },
    ]);
  });
});
