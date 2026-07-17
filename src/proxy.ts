import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PRODUCTION_DOMAIN = "limon.lat";
const TENANT_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function authorityHost(value: string | null): string | null | undefined {
  if (value === null) return undefined;
  if (!value || value !== value.trim() || /[,/@\\?#]/.test(value)) return null;
  try {
    const authority = new URL(`http://${value}`);
    if (
      authority.username ||
      authority.password ||
      authority.pathname !== "/" ||
      authority.search ||
      authority.hash
    ) {
      return null;
    }
    return authority.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const hostAuthority = authorityHost(request.headers.get("host"));
  const forwardedAuthority = authorityHost(
    request.headers.get("x-forwarded-host"),
  );

  if (hostAuthority === null || forwardedAuthority === null) {
    return new NextResponse("Invalid host", { status: 400 });
  }

  const host = hostAuthority ?? request.nextUrl.hostname.toLowerCase();
  const forwarded = forwardedAuthority ?? host;

  if (!host || !forwarded || host !== forwarded) {
    return new NextResponse("Invalid host", { status: 400 });
  }

  if (host === `www.${PRODUCTION_DOMAIN}`) {
    const destination = request.nextUrl.clone();
    destination.hostname = PRODUCTION_DOMAIN;
    destination.port = "";
    destination.protocol = "https:";
    return NextResponse.redirect(destination, 308);
  }

  if (host === PRODUCTION_DOMAIN || !host.endsWith(`.${PRODUCTION_DOMAIN}`)) {
    return NextResponse.next();
  }

  const labels = host.slice(0, -`.${PRODUCTION_DOMAIN}`.length).split(".");
  if (
    labels.length !== 1 ||
    !TENANT_LABEL.test(labels[0]) ||
    labels[0] === "www"
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const slug = labels[0];
  if (request.nextUrl.pathname !== "/") {
    const canonical = new URL(`https://${slug}.${PRODUCTION_DOMAIN}/`);
    return NextResponse.redirect(canonical, 308);
  }

  const destination = request.nextUrl.clone();
  destination.pathname = `/r/${slug}`;
  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next(?:/|$)|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|.*\\.[^/]+$).*)",
  ],
};
