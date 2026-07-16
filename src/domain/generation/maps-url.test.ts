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
    expect(parameterized).toBe("https://www.google.com/maps?place_id=ChIJ123");
  });

  it("deduplicates links by stable place identity instead of display details", async () => {
    const first = await resolveGoogleMapsUrl(
      "https://www.google.com/maps/place/Old+Name?query_place_id=ChIJ123&utm_source=share",
    );
    const renamed = await resolveGoogleMapsUrl(
      "https://www.google.com.pe/maps/place/New+Name?ved=incidental&query_place_id=ChIJ123",
    );

    expect(first).toBe("https://www.google.com/maps?place_id=ChIJ123");
    expect(renamed).toBe(first);
  });

  it("canonicalizes equivalent place-ID parameter forms", async () => {
    const links = [
      "https://www.google.com/maps?query_place_id=ChIJ123",
      "https://www.google.com/maps?place_id=ChIJ123",
      "https://www.google.com/maps?q=place_id:ChIJ123",
    ];

    await expect(
      Promise.all(links.map((link) => resolveGoogleMapsUrl(link))),
    ).resolves.toEqual(
      links.map(() => "https://www.google.com/maps?place_id=ChIJ123"),
    );
  });

  it("canonicalizes place IDs and FTIDs from modern Maps data paths", async () => {
    const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    const ftid = "0x9105c8b6f1a2b3c4:0x1234567890abcdef";

    await expect(
      Promise.all([
        resolveGoogleMapsUrl(
          `https://www.google.com/maps/place/Cafe/data=!4m2!3m1!19s${placeId}`,
        ),
        resolveGoogleMapsUrl(
          `https://maps.google.com/maps?query_place_id=${placeId}`,
        ),
      ]),
    ).resolves.toEqual([
      `https://www.google.com/maps?place_id=${placeId}`,
      `https://www.google.com/maps?place_id=${placeId}`,
    ]);

    const cid = "1311768467294899695";
    await expect(
      Promise.all([
        resolveGoogleMapsUrl(
          `https://www.google.com/maps/place/Cafe/data=!4m2!3m1!1s${ftid}`,
        ),
        resolveGoogleMapsUrl(`https://maps.google.com/maps?ftid=${ftid}`),
        resolveGoogleMapsUrl(`https://maps.google.com/maps?cid=${cid}`),
      ]),
    ).resolves.toEqual([
      `https://www.google.com/maps?cid=${cid}`,
      `https://www.google.com/maps?cid=${cid}`,
      `https://www.google.com/maps?cid=${cid}`,
    ]);
  });

  it.each([
    `${placeUrl}/data=!4m2!3m1!19sChIJPath?query_place_id=ChIJQuery`,
    "https://www.google.com/maps?query_place_id=ChIJOne&place_id=ChIJTwo",
    "https://www.google.com/maps?place_id=ChIJOne&place_id=ChIJTwo",
    "https://www.google.com/maps?ftid=0x1:0x2&cid=3",
    `${placeUrl}/data=!19sChIJOne!19sChIJTwo`,
    `${placeUrl}/data=!1s0x1:0x2!1s0x1:0x3`,
  ])("rejects conflicting place identities: %s", async (input) => {
    await expect(resolveGoogleMapsUrl(input)).rejects.toBeInstanceOf(
      UnsupportedMapsUrlError,
    );
  });

  it("accepts equivalent FTID and CID identities across path and query", async () => {
    await expect(
      resolveGoogleMapsUrl(
        "https://www.google.com/maps/place/Cafe/data=!4m2!3m1!1s0x1:0x2?cid=2",
      ),
    ).resolves.toBe("https://www.google.com/maps?cid=2");
  });

  it("prefers a place ID when a modern data path also contains an FTID", async () => {
    const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    const ftid = "0x9105c8b6f1a2b3c4:0x1234567890abcdef";

    await expect(
      resolveGoogleMapsUrl(
        `https://www.google.com/maps/place/Cafe/data=!4m6!3m5!1s${ftid}!8m2!3d-12.1!4d-77.1!19s${placeId}`,
      ),
    ).resolves.toBe(`https://www.google.com/maps?place_id=${placeId}`);
  });

  it("does not treat identity-like text in a place label as identity data", async () => {
    const first = await resolveGoogleMapsUrl(
      "https://www.google.com/maps/place/A!19sChIJ123",
    );
    const second = await resolveGoogleMapsUrl(
      "https://www.google.com/maps/place/B!19sChIJ123",
    );

    expect(first).toBe("https://www.google.com/maps/place/A!19sChIJ123");
    expect(second).toBe("https://www.google.com/maps/place/B!19sChIJ123");
    expect(first).not.toBe(second);
  });

  it("supports the genuine root CID form and canonicalizes it", async () => {
    await expect(
      resolveGoogleMapsUrl("https://maps.google.com/?cid=12345678901234567890"),
    ).resolves.toBe("https://www.google.com/maps?cid=12345678901234567890");
  });

  it.each([
    "http://www.google.com/maps/place/Cafe",
    "https://google.com.evil.test/maps/place/Cafe",
    "https://google.com@evil.test/maps/place/Cafe",
    "https://user:pass@www.google.com/maps/place/Cafe",
    "https://www.google.com/search?q=Cafe",
    "https://www.google.com/maps/@-12.1,-77.1,14z",
    "https://www.google.com/maps?cid=",
    "https://www.google.com/maps?q=place_id:",
    "https://www.google.com/maps?query_place_id=%20",
    "https://www.google.com/maps?cid=12not-a-cid",
    "https://www.google.com/maps?ftid=0x1234:not-hex",
    "https://www.google.com/maps?place_id=not%20a%20place%20id",
    "https://www.google.com/maps/place/Cafe%ZZ",
    "https://www.google.com/maps/place/Cafe/data=",
    "https://www.google.com/maps/place//data=!19s",
    "https://www.google.com/maps/place//data=garbage",
    "https://www.google.com/maps/place/Cafe/unsupported/trailing/path",
    "https://www.google.com/?cid=123456789",
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

  it("accepts empty-label place data paths directly and after redirects", async () => {
    const destination =
      "https://www.google.com/maps/place//data=!4m2!3m1!19sChIJEmptyLabel";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: destination },
      }),
    );

    await expect(resolveGoogleMapsUrl(destination)).resolves.toBe(
      "https://www.google.com/maps?place_id=ChIJEmptyLabel",
    );
    await expect(
      resolveGoogleMapsUrl("https://maps.app.goo.gl/empty", fetcher),
    ).resolves.toBe("https://www.google.com/maps?place_id=ChIJEmptyLabel");
    expect(fetcher).toHaveBeenCalledOnce();
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

  it("rejects a malformed place path reached through a short link", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "https://www.google.com/maps/place//data=garbage",
        },
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
