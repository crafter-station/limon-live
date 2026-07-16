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
type IdentityParameter = "place_id" | "ftid" | "cid";
type PlaceIdentity = readonly ["place_id" | "cid", string];

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
  name: IdentityParameter,
  value: string,
): PlaceIdentity {
  const normalized = identityValidators[name](value);
  if (!normalized) throw new UnsupportedMapsUrlError();
  if (name === "ftid") {
    return ["cid", BigInt(normalized.split(":")[1]).toString()];
  }
  return [name, normalized];
}

function getParameterIdentity(url: URL): PlaceIdentity | undefined {
  const identities: PlaceIdentity[] = [];

  for (const parameter of ["query_place_id", "place_id"] as const) {
    for (const value of url.searchParams.getAll(parameter)) {
      identities.push(validateIdentity("place_id", value));
    }
  }

  for (const q of url.searchParams.getAll("q")) {
    if (q.startsWith("place_id:")) {
      identities.push(
        validateIdentity("place_id", q.slice("place_id:".length)),
      );
    }
  }

  for (const ftid of url.searchParams.getAll("ftid")) {
    identities.push(validateIdentity("ftid", ftid));
  }
  for (const cid of url.searchParams.getAll("cid")) {
    identities.push(validateIdentity("cid", cid));
  }

  const identity = identities[0];
  if (
    identities.some(
      ([name, value]) => name !== identity?.[0] || value !== identity[1],
    )
  ) {
    throw new UnsupportedMapsUrlError();
  }
  return identity;
}

function getPathIdentities(url: URL): PlaceIdentity[] {
  const data = url.pathname.match(/\/data=([^/]*)\/?$/)?.[1];
  if (!data) return [];

  const identities = [
    ...Array.from(data.matchAll(/!19s([^!/?#]+)/g), (match) => [
      "place_id" as const,
      match[1],
    ]),
    ...Array.from(data.matchAll(/!1s([^!/?#]+)/g), (match) => [
      "ftid" as const,
      match[1],
    ]),
  ].map(([name, encodedValue]) => {
    let value: string;
    try {
      value = decodeURIComponent(encodedValue);
    } catch {
      throw new UnsupportedMapsUrlError();
    }

    return validateIdentity(name, value);
  });

  const uniqueIdentities = identities.filter(
    (identity, index) =>
      identities.findIndex(
        ([name, value]) => name === identity[0] && value === identity[1],
      ) === index,
  );
  if (
    uniqueIdentities.some(
      ([name], index) =>
        uniqueIdentities.findIndex(([otherName]) => otherName === name) !==
        index,
    )
  ) {
    throw new UnsupportedMapsUrlError();
  }

  return uniqueIdentities;
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
  const pathIdentities = getPathIdentities(url);
  if (
    parameterIdentity &&
    pathIdentities.length > 0 &&
    !pathIdentities.some(
      ([name, value]) =>
        name === parameterIdentity[0] && value === parameterIdentity[1],
    )
  ) {
    throw new UnsupportedMapsUrlError();
  }
  const identity = pathIdentities[0] ?? parameterIdentity;

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
