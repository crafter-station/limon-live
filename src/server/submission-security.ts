import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const KEY_DERIVATION_CONTEXT = "limon/request-rate-limit/v1";

declare const requesterKeyBrand: unique symbol;
export type RequesterKey = string & {
  readonly [requesterKeyBrand]: true;
};

export function deriveRequesterKey(
  requesterAddress: string,
  databaseCredential: string,
): RequesterKey {
  const key = createHmac("sha256", databaseCredential)
    .update(KEY_DERIVATION_CONTEXT)
    .digest();
  return createHmac("sha256", key)
    .update(requesterAddress)
    .digest("hex") as RequesterKey;
}

export function getRequesterAddress(requestHeaders: Headers): string {
  const address = requestHeaders
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (!address || !isIP(address)) return "unknown";
  if (isIP(address) === 4) return address;

  return new URL(`http://[${address}]`).hostname.slice(1, -1);
}

export function utcHour(date: Date): Date {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}
