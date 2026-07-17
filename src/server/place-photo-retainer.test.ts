import { describe, expect, it, vi } from "vitest";
import { normalizeRestaurant } from "@/domain/generation/live-provider";
import {
  PHOTO_CONCURRENCY,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_REDIRECTS,
  PHOTO_TIMEOUT_MS,
  PlacePhotoRetainer,
} from "./place-photo-retainer";

const mapsUrl = "https://www.google.com/maps/place/Cafe";

function restaurant(urls: string[]) {
  return normalizeRestaurant(
    {
      title: "Café Limon",
      categoryName: "Café",
      address: "Calle Lima 10",
      city: "Lima",
      location: { lat: -12.12, lng: -77.03 },
      imageUrls: urls,
    },
    "apify-google-maps",
    mapsUrl,
    "2026-07-16T00:00:00.000Z",
  );
}

function imageResponse(
  body: BodyInit = new Uint8Array([1, 2, 3]),
  headers: HeadersInit = {},
) {
  return new Response(body, {
    headers: { "content-type": "image/jpeg", ...headers },
  });
}

const blobUrl = (path: string) =>
  `https://store.public.blob.vercel-storage.com/${path}`;

describe("place photo retention", () => {
  it("revalidates manual redirects and writes deterministic generation paths", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://lh4.googleusercontent.com/final" },
        }),
      )
      .mockResolvedValueOnce(imageResponse());
    const writer = vi.fn(async (path: string) => ({ url: blobUrl(path) }));
    const input = restaurant(["https://lh3.googleusercontent.com/start"]);

    const output = await new PlacePhotoRetainer(
      "blob-token",
      fetcher as typeof fetch,
      writer,
    ).retain("generation-id", input);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      new URL("https://lh3.googleusercontent.com/start"),
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(writer).toHaveBeenCalledWith(
      "restaurant-generations/generation-id/photos/0.jpg",
      expect.any(Uint8Array),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "image/jpeg",
        token: "blob-token",
      },
    );
    expect(output.photos[0]).toMatchObject({
      url: blobUrl("restaurant-generations/generation-id/photos/0.jpg"),
      alt: "Foto 1 de Café Limon",
    });
    expect(JSON.stringify(output)).not.toContain("googleusercontent.com");
  });

  it("overwrites the same deterministic path on retry", async () => {
    const stored = new Set<string>();
    const writer = vi.fn(async (path: string, _body, options) => {
      if (stored.has(path) && !options.allowOverwrite) {
        throw new Error("Blob already exists");
      }
      stored.add(path);
      return { url: blobUrl(path) };
    });
    const input = restaurant(["https://lh3.googleusercontent.com/photo"]);
    const retainer = new PlacePhotoRetainer(
      "blob-token",
      vi.fn(async () => imageResponse()) as typeof fetch,
      writer,
    );

    const first = await retainer.retain("generation-id", input);
    const retry = await retainer.retain("generation-id", input);

    expect(first.photos).toEqual(retry.photos);
    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer.mock.calls[0][0]).toBe(writer.mock.calls[1][0]);
    expect(writer.mock.calls[1][2]).toMatchObject({ allowOverwrite: true });
  });

  it("rejects host, scheme, credential, port, and redirect attacks", async () => {
    const invalid = [
      "http://lh3.googleusercontent.com/photo",
      "https://evil.example/photo",
      "https://lh3.googleusercontent.com.evil.example/photo",
      "https://user@lh3.googleusercontent.com/photo",
      "https://lh3.googleusercontent.com:444/photo",
    ];
    for (const url of invalid) {
      const fetcher = vi.fn();
      const writer = vi.fn();
      const output = await new PlacePhotoRetainer(
        "token",
        fetcher as typeof fetch,
        writer,
      ).retain("id", restaurant([url]));
      expect(output.photos).toEqual([]);
      expect(fetcher).not.toHaveBeenCalled();
      expect(writer).not.toHaveBeenCalled();
    }

    const redirect = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://attacker.example/image.jpg" },
        }),
    );
    const output = await new PlacePhotoRetainer(
      "token",
      redirect as typeof fetch,
      vi.fn(),
    ).retain("id", restaurant(["https://lh3.googleusercontent.com/photo"]));
    expect(output.photos).toEqual([]);
  });

  it("enforces redirect, timeout, type, declared-size, and streamed-size limits", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const cases: Array<() => Promise<Response>> = [
      async () =>
        new Response("html", { headers: { "content-type": "text/html" } }),
      async () =>
        imageResponse(undefined, {
          "content-length": String(PHOTO_MAX_BYTES + 1),
        }),
      async () => imageResponse(new Uint8Array(PHOTO_MAX_BYTES + 1)),
      async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    ];
    for (const response of cases) {
      const output = await new PlacePhotoRetainer(
        "token",
        vi.fn(response) as typeof fetch,
        vi.fn(),
      ).retain("id", restaurant(["https://lh3.googleusercontent.com/photo"]));
      expect(output.photos).toEqual([]);
    }
    expect(timeout).toHaveBeenCalledWith(PHOTO_TIMEOUT_MS);

    const redirect = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://lh3.googleusercontent.com/again" },
        }),
    );
    await new PlacePhotoRetainer(
      "token",
      redirect as typeof fetch,
      vi.fn(),
    ).retain("id", restaurant(["https://lh3.googleusercontent.com/photo"]));
    expect(redirect).toHaveBeenCalledTimes(PHOTO_MAX_REDIRECTS + 1);
    timeout.mockRestore();
  });

  it("bounds concurrency while preserving ranked partial successes", async () => {
    const releases: Array<(response: Response) => void> = [];
    let active = 0;
    let peak = 0;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          active += 1;
          peak = Math.max(peak, active);
          releases.push((response) => {
            active -= 1;
            resolve(response);
          });
        }),
    );
    const writer = vi.fn(async (path: string) => ({ url: blobUrl(path) }));
    const pending = new PlacePhotoRetainer(
      "token",
      fetcher as typeof fetch,
      writer,
    ).retain(
      "id",
      restaurant([
        "https://lh3.googleusercontent.com/one",
        "https://lh4.googleusercontent.com/two",
        "https://lh5.googleusercontent.com/three",
      ]),
    );
    await vi.waitFor(() =>
      expect(fetcher).toHaveBeenCalledTimes(PHOTO_CONCURRENCY),
    );
    releases.shift()?.(imageResponse());
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    releases.shift()?.(new Response("bad", { status: 500 }));
    releases.shift()?.(imageResponse());
    const output = await pending;

    expect(peak).toBe(PHOTO_CONCURRENCY);
    expect(output.photos.map((photo) => photo.alt)).toEqual([
      "Foto 1 de Café Limon",
      "Foto 3 de Café Limon",
    ]);
    expect(writer).toHaveBeenCalledTimes(2);
  });
});
