const MAX_URL_LENGTH = 2_048;
const MAX_SHORT_LINK_REDIRECTS = 4;
const REDIRECT_TIMEOUT_MS = 3_000;

const fullHosts = new Set([
  "google.com",
  "maps.google.com",
  "www.google.com",
  "google.com.pe",
  "maps.google.com.pe",
  "www.google.com.pe",
]);

const shortHosts = new Set(["maps.app.goo.gl", "goo.gl"]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export class UnsupportedMapsUrlError extends Error {}
export class MapsUrlResolutionError extends Error {}

type UrlKind = "full" | "short";

function getParameterIdentity(url: URL): readonly [string, string] | undefined {
  const qPlaceId = url.searchParams.get("q")?.match(/^place_id:(.+)$/)?.[1];
  const placeId = [
    url.searchParams.get("query_place_id"),
    url.searchParams.get("place_id"),
    qPlaceId,
  ].find(
    (value) =>
      typeof value === "string" && value.length > 0 && value.trim() === value,
  );
  const candidates = [
    ["place_id", placeId],
    ["ftid", url.searchParams.get("ftid")],
    ["cid", url.searchParams.get("cid")],
  ] as const;

  for (const [name, value] of candidates) {
    if (value && value.trim() === value) return [name, value];
  }
}

function parseSupportedUrl(input: string): { kind: UrlKind; url: URL } {
  if (input.length > MAX_URL_LENGTH) throw new UnsupportedMapsUrlError();

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new UnsupportedMapsUrlError();
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new UnsupportedMapsUrlError();
  }

  const hostname = url.hostname.toLowerCase();
  if (shortHosts.has(hostname)) {
    const supportedPath =
      hostname === "maps.app.goo.gl"
        ? /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
        : /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (!supportedPath) throw new UnsupportedMapsUrlError();
    return { kind: "short", url };
  }

  if (!fullHosts.has(hostname)) throw new UnsupportedMapsUrlError();

  const hasPlacePath = /^\/maps\/place\/[^/]+/.test(url.pathname);
  const hasPlaceParameter = getParameterIdentity(url) !== undefined;
  const hasSupportedParameterizedPath =
    /^\/maps\/?$/.test(url.pathname) ||
    /^\/maps\/search\/?$/.test(url.pathname);

  if (!hasPlacePath && !(hasSupportedParameterizedPath && hasPlaceParameter)) {
    throw new UnsupportedMapsUrlError();
  }

  return { kind: "full", url };
}

function normalizeFullUrl(url: URL): string {
  const parameterIdentity = getParameterIdentity(url);
  const pathIdentity = url.pathname.match(/!1s([^!]+)/)?.[1];
  const identity =
    parameterIdentity ??
    (pathIdentity ? (["place_id", pathIdentity] as const) : undefined);

  if (identity) {
    const [name, value] = identity;
    const identityUrl = new URL("https://www.google.com/maps");
    identityUrl.searchParams.set(name, value);
    return identityUrl.toString();
  }

  const normalized = new URL(url);
  normalized.hostname = "www.google.com";
  normalized.hash = "";
  normalized.pathname =
    normalized.pathname.length > 1
      ? normalized.pathname.replace(/\/+$/, "")
      : normalized.pathname;

  normalized.search = "";
  return normalized.toString();
}

export async function resolveGoogleMapsUrl(
  input: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  let parsed = parseSupportedUrl(input);
  if (parsed.kind === "full") return normalizeFullUrl(parsed.url);

  for (
    let redirectCount = 0;
    redirectCount < MAX_SHORT_LINK_REDIRECTS;
    redirectCount += 1
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REDIRECT_TIMEOUT_MS);

    try {
      const response = await fetcher(parsed.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
      void response.body?.cancel();

      if (!redirectStatuses.has(response.status)) {
        throw new MapsUrlResolutionError();
      }

      const location = response.headers.get("location");
      if (!location) throw new MapsUrlResolutionError();

      let destination: string;
      try {
        destination = new URL(location, parsed.url).toString();
      } catch {
        throw new MapsUrlResolutionError();
      }

      parsed = parseSupportedUrl(destination);
      if (parsed.kind === "full") return normalizeFullUrl(parsed.url);
    } catch (error) {
      if (error instanceof UnsupportedMapsUrlError) throw error;
      if (error instanceof MapsUrlResolutionError) throw error;
      throw new MapsUrlResolutionError();
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new MapsUrlResolutionError();
}
