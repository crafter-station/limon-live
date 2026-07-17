import {
  unstable_doesMiddlewareMatch as doesProxyMatch,
  getRedirectUrl,
  getRewrittenUrl,
  isRewrite,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { restaurantSlug } from "./domain/generation/coordinator";
import { config, proxy } from "./proxy";

function request(host: string, path = "/", headers: HeadersInit = {}) {
  return new NextRequest(`https://${host}${path}`, {
    headers: { host, "x-forwarded-host": host, ...headers },
  });
}

describe("production host proxy", () => {
  it("leaves apex marketing and local or preview slug paths unchanged", () => {
    expect(proxy(request("limon.lat"))).toHaveProperty("status", 200);
    expect(proxy(request("localhost:3000", "/r/las-palmeras"))).toHaveProperty(
      "status",
      200,
    );
    expect(
      proxy(request("limon-git-main.vercel.app", "/r/las-palmeras")),
    ).toHaveProperty("status", 200);
  });

  it("permanently redirects www while preserving the equivalent URL", () => {
    const response = proxy(request("www.limon.lat", "/about?from=www"));
    expect(response.status).toBe(308);
    expect(getRedirectUrl(response)).toBe("https://limon.lat/about?from=www");
  });

  it("rewrites a valid first-level tenant root and canonicalizes non-root paths", () => {
    const root = proxy(request("las-palmeras.limon.lat"));
    expect(isRewrite(root)).toBe(true);
    expect(getRewrittenUrl(root)).toBe(
      "https://las-palmeras.limon.lat/r/las-palmeras",
    );

    const nestedPath = proxy(request("las-palmeras.limon.lat", "/menu?old=1"));
    expect(nestedPath.status).toBe(308);
    expect(getRedirectUrl(nestedPath)).toBe("https://las-palmeras.limon.lat/");
  });

  it.each([
    "Restaurante con un nombre extraordinariamente largo que excede una etiqueta DNS completa",
    "ÁÉÍÓÚ Ñandú — ¡Sabores, tradición y corazón! ".repeat(4),
  ])("routes the bounded production slug generated from %s", (name) => {
    const slug = restaurantSlug(name, "https://maps.app.goo.gl/long-name");
    const response = proxy(request(`${slug}.limon.lat`));

    expect(slug.length).toBeLessThanOrEqual(63);
    expect(getRewrittenUrl(response)).toBe(
      `https://${slug}.limon.lat/r/${slug}`,
    );
  });

  it("fails closed for nested, malformed, or conflicting production hosts", () => {
    expect(proxy(request("a.b.limon.lat")).status).toBe(404);
    expect(proxy(request("-bad.limon.lat")).status).toBe(404);
    expect(
      proxy(
        request("las-palmeras.limon.lat", "/", {
          "x-forwarded-host": "evil.example",
        }),
      ).status,
    ).toBe(400);
  });

  it.each([
    "evil.example, limon.lat",
    "limon.lat/path",
    "limon.lat:notaport",
    "user@limon.lat",
    "limon.lat?other=host",
    "limon.lat#other-host",
  ])("fails closed for malformed Host authority %s", (host) => {
    expect(proxy(request("limon.lat", "/", { host })).status).toBe(400);
  });

  it.each([
    "evil.example, limon.lat",
    "las-palmeras.limon.lat/path",
    "las-palmeras.limon.lat:notaport",
    "user@las-palmeras.limon.lat",
  ])("fails closed for malformed forwarded authority %s", (forwardedHost) => {
    expect(
      proxy(
        request("las-palmeras.limon.lat", "/", {
          "x-forwarded-host": forwardedHost,
        }),
      ).status,
    ).toBe(400);
  });

  it("uses the request URL only when Host is absent", () => {
    const absentHost = new NextRequest("https://limon.lat/", {
      headers: { "x-forwarded-host": "limon.lat" },
    });
    expect(proxy(absentHost)).toHaveProperty("status", 200);
  });

  it.each([
    "/api/generations/id",
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/images/hero.png",
  ])("excludes %s from proxy execution", (url) => {
    expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
  });
});
