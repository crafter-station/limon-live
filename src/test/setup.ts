import { vi } from "vitest";

vi.stubGlobal(
  "fetch",
  vi.fn(() => {
    throw new Error("Network access is disabled in automated tests.");
  }),
);
