import "server-only";
import { createGateway, generateText, Output } from "ai";
import {
  type Menu,
  type MenuExtraction,
  menuExtractionSchema,
  validateGroundedMenu,
} from "@/domain/menu";
import type { NormalizedRestaurant } from "@/domain/restaurant";

export const MENU_MODEL_ID = "google/gemini-2.5-flash-lite" as const;
export const MENU_CANDIDATE_LIMIT = 3 as const;
export const MENU_TIMEOUT_MS = 15_000 as const;
export const MENU_MAX_RETRIES = 1 as const;
export const MENU_MAX_OUTPUT_TOKENS = 1_800 as const;
export const MENU_CONCURRENCY = 2 as const;

type Photo = NormalizedRestaurant["photos"][number];
type MenuExecutor = (
  photos: readonly Photo[],
  abortSignal: AbortSignal,
) => Promise<MenuExtraction>;
type MenuLimits = { timeoutMs: number; maxRetries: number };

let active = 0;
const waiters: Array<() => void> = [];

async function withConcurrency<T>(work: () => Promise<T>) {
  if (active >= MENU_CONCURRENCY) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active += 1;
  try {
    return await work();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

export class MenuExtractor {
  constructor(
    private readonly execute: MenuExecutor,
    private readonly limits: MenuLimits = {
      timeoutMs: MENU_TIMEOUT_MS,
      maxRetries: MENU_MAX_RETRIES,
    },
  ) {}

  private async executeBounded(photos: readonly Photo[]) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.limits.maxRetries; attempt += 1) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          this.execute(photos, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error("Menu extraction timed out."));
            }, this.limits.timeoutMs);
          }),
        ]);
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  async extract(photos: readonly Photo[]): Promise<Menu | null> {
    const candidates = photos.slice(0, MENU_CANDIDATE_LIMIT);
    if (candidates.length === 0) return null;
    const output = menuExtractionSchema.parse(
      await withConcurrency(() => this.executeBounded(candidates)),
    );
    return validateGroundedMenu(output, candidates.length);
  }
}

export function createGatewayMenuExtractor(apiKey: string) {
  const gateway = createGateway({ apiKey });
  return new MenuExtractor(async (photos, abortSignal) => {
    const { output } = await generateText({
      model: gateway(MENU_MODEL_ID),
      output: Output.object({ schema: menuExtractionSchema }),
      maxOutputTokens: MENU_MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      abortSignal,
      system:
        "Extract only a menu visibly written in the supplied retained place photos. Preserve spelling exactly. Never infer dishes, descriptions, prices, section names, or currencies. Return no_menu for empty, unreadable, food-only, people, interior, storefront, or other non-menu photos. visibleText must be a verbatim contiguous transcription containing every field for that item. Use decimal strings and only visible PEN, S/, or S/. prices.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract a visibly grounded menu, if any." },
            ...photos.map((photo) => ({
              type: "image" as const,
              image: new URL(photo.url),
            })),
          ],
        },
      ],
    });
    return output;
  });
}
