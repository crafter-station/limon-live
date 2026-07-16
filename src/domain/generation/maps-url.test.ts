import { describe, expect, it, vi } from "vitest";
import {
  MapsUrlResolutionError,
  resolveGoogleMapsUrl,
  UnsupportedMapsUrlError,
} from "./maps-url";

const placeUrl =
  "https://www.google.com/maps/place/Las+Palmeras,+Miraflores,+Lima";

describe("Google Maps URL resolution", () => {
  it("normalizes equivalent full links and retains identity parameters", async () => {
    const first = await resolveGoogleMapsUrl(
      `${placeUrl}/?utm_source=share&entry=ttu#reviews`,
    );
    const regional = await resolveGoogleMapsUrl(
      "https://www.google.com.pe/maps/place/Las+Palmeras,+Miraflores,+Lima",
    );
    const parameterized = await resolveGoogleMapsUrl(
      "https://maps.google.com/maps?query_place_id=ChIJ123&g_st=ic",
    );

    expect(first).toBe(placeUrl);
    expect(regional).toBe(placeUrl);
    expect(parameterized).toBe(
      "https://www.google.com/maps?query_place_id=ChIJ123",
    );
  });

  it("deduplicates links by stable place identity instead of display details", async () => {
    const first = await resolveGoogleMapsUrl(
      "https://www.google.com/maps/place/Old+Name?query_place_id=ChIJ123&utm_source=share",
    );
    const renamed = await resolveGoogleMapsUrl(
      "https://www.google.com.pe/maps/place/New+Name?ved=incidental&query_place_id=ChIJ123",
    );

    expect(first).toBe("https://www.google.com/maps?query_place_id=ChIJ123");
    expect(renamed).toBe(first);
  });

  it.each([
    "http://www.google.com/maps/place/Cafe",
    "https://google.com.evil.test/maps/place/Cafe",
    "https://google.com@evil.test/maps/place/Cafe",
    "https://user:pass@www.google.com/maps/place/Cafe",
    "https://www.google.com/search?q=Cafe",
    "https://www.google.com/maps/@-12.1,-77.1,14z",
    "not a url",
  ])("rejects unsafe or unsupported input: %s", async (input) => {
    await expect(resolveGoogleMapsUrl(input)).rejects.toBeInstanceOf(
      UnsupportedMapsUrlError,
    );
  });

  it("follows short redirects manually and revalidates every hop", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://goo.gl/maps/second" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: `${placeUrl}?utm_medium=share` },
        }),
      );

    await expect(
      resolveGoogleMapsUrl("https://maps.app.goo.gl/first", fetcher),
    ).resolves.toBe(placeUrl);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledWith(
      "https://maps.app.goo.gl/first",
      expect.objectContaining({ method: "GET", redirect: "manual" }),
    );
  });

  it("rejects an unsafe redirect destination", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://internal.example.test/secret" },
      }),
    );

    await expect(
      resolveGoogleMapsUrl("https://maps.app.goo.gl/first", fetcher),
    ).rejects.toBeInstanceOf(UnsupportedMapsUrlError);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("bounds redirect chains and network failures", async () => {
    const loopingFetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://maps.app.goo.gl/again" },
      }),
    );
    const failingFetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("timeout details"));

    await expect(
      resolveGoogleMapsUrl("https://maps.app.goo.gl/first", loopingFetcher),
    ).rejects.toBeInstanceOf(MapsUrlResolutionError);
    expect(loopingFetcher).toHaveBeenCalledTimes(4);
    await expect(
      resolveGoogleMapsUrl("https://maps.app.goo.gl/first", failingFetcher),
    ).rejects.toBeInstanceOf(MapsUrlResolutionError);
  });

  it("aborts a short-link request after the timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });

    try {
      const resolution = resolveGoogleMapsUrl(
        "https://maps.app.goo.gl/first",
        fetcher,
      );
      const rejection = expect(resolution).rejects.toBeInstanceOf(
        MapsUrlResolutionError,
      );
      await vi.advanceTimersByTimeAsync(3_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps different place links distinct", async () => {
    await expect(
      Promise.all([
        resolveGoogleMapsUrl("https://www.google.com/maps/place/Cafe+Norte"),
        resolveGoogleMapsUrl("https://www.google.com/maps/place/Cafe+Sur"),
      ]),
    ).resolves.toEqual([
      "https://www.google.com/maps/place/Cafe+Norte",
      "https://www.google.com/maps/place/Cafe+Sur",
    ]);
  });
});
