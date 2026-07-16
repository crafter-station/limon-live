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
type PlaceIdentity = readonly ["place_id" | "ftid" | "cid", string];

const identityValidators = {
  place_id: (value: string) =>
    /^[A-Za-z0-9_-]+$/.test(value) ? value : undefined,
  ftid: (value: string) =>
    /^0x[0-9a-f]{1,16}:0x[0-9a-f]{1,16}$/i.test(value)
      ? value.toLowerCase()
      : undefined,
  cid: (value: string) => {
    if (!/^\d{1,20}$/.test(value)) return undefined;
    const cid = BigInt(value);
    return cid <= BigInt("18446744073709551615") ? cid.toString() : undefined;
  },
} as const;

function validateIdentity(
  name: PlaceIdentity[0],
  value: string,
): PlaceIdentity {
  const normalized = identityValidators[name](value);
  if (!normalized) throw new UnsupportedMapsUrlError();
  return [name, normalized];
}

function getParameterIdentity(url: URL): PlaceIdentity | undefined {
  for (const parameter of ["query_place_id", "place_id"] as const) {
    if (url.searchParams.has(parameter)) {
      return validateIdentity(
        "place_id",
        url.searchParams.get(parameter) ?? "",
      );
    }
  }

  const q = url.searchParams.get("q");
  if (q?.startsWith("place_id:")) {
    return validateIdentity("place_id", q.slice("place_id:".length));
  }

  if (url.searchParams.has("ftid")) {
    return validateIdentity("ftid", url.searchParams.get("ftid") ?? "");
  }
  if (url.searchParams.has("cid")) {
    return validateIdentity("cid", url.searchParams.get("cid") ?? "");
  }
}

function getPathIdentity(url: URL): PlaceIdentity | undefined {
  const data = url.pathname.match(/\/data=([^/]*)\/?$/)?.[1];
  if (!data) return undefined;

  const placeIdMatch = data.match(/!19s([^!/?#]+)/);
  const ftidMatch = data.match(/!1s([^!/?#]+)/);
  const match = placeIdMatch ?? ftidMatch;
  if (!match) return undefined;

  let value: string;
  try {
    value = decodeURIComponent(match[1]);
  } catch {
    throw new UnsupportedMapsUrlError();
  }

  return validateIdentity(placeIdMatch ? "place_id" : "ftid", value);
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

  const hasPlacePath =
    /^\/maps\/place\/[^/]+(?:\/@[^/]+)?(?:\/data=[^/]*)?\/?$/.test(
      url.pathname,
    );
  const hasPlaceParameter = getParameterIdentity(url) !== undefined;
  const hasSupportedParameterizedPath =
    /^\/maps\/?$/.test(url.pathname) ||
    /^\/maps\/search\/?$/.test(url.pathname);
  const hasSupportedRootCid =
    hostname === "maps.google.com" &&
    url.pathname === "/" &&
    getParameterIdentity(url)?.[0] === "cid";

  if (
    !hasPlacePath &&
    !(hasSupportedParameterizedPath && hasPlaceParameter) &&
    !hasSupportedRootCid
  ) {
    throw new UnsupportedMapsUrlError();
  }

  return { kind: "full", url };
}

function normalizeFullUrl(url: URL): string {
  const parameterIdentity = getParameterIdentity(url);
  const identity = parameterIdentity ?? getPathIdentity(url);

  if (identity) {
    const [name, value] = identity;
    const identityUrl = new URL("https://www.google.com/maps");
    identityUrl.searchParams.set(name, value);
    const normalized = identityUrl.toString();
    return name === "ftid" ? normalized.replace("%3A", ":") : normalized;
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
