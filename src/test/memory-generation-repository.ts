import { randomUUID } from "node:crypto";
import {
  GENERATION_FAILURE_MESSAGE,
  type Generation,
  type GenerationRepository,
  MAX_GENERATION_ATTEMPTS,
} from "@/domain/generation/types";
import type { Menu } from "@/domain/menu";
import type { NormalizedRestaurant } from "@/domain/restaurant";

export class MemoryGenerationRepository implements GenerationRepository {
  private readonly records = new Map<string, Generation>();
  private interruptPublication = false;

  interruptNextPublication() {
    this.interruptPublication = true;
  }

  removeCheckpointPhotos(id: string) {
    const checkpoint = this.records.get(id)?.providerCheckpoint;
    if (checkpoint) delete (checkpoint as Partial<NormalizedRestaurant>).photos;
  }

  async createOrGet(sourceUrl: string, normalizedSource: string) {
    const existing = [...this.records.values()].find(
      (record) => record.normalizedSource === normalizedSource,
    );
    if (existing) return structuredClone(existing);

    const now = new Date("2026-07-16T10:00:00.000Z");
    const generation: Generation = {
      id: randomUUID(),
      sourceUrl,
      normalizedSource,
      status: "pending",
      providerCheckpoint: null,
      publishedData: null,
      menuStatus: "pending",
      menuData: null,
      menuSafeError: null,
      slug: null,
      safeError: null,
      leaseToken: null,
      leaseAcquiredAt: null,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(generation.id, generation);
    return structuredClone(generation);
  }

  async findById(id: string) {
    const record = this.records.get(id);
    return record ? structuredClone(record) : null;
  }

  async findReadyBySlug(slug: string) {
    const record = [...this.records.values()].find(
      (candidate) => candidate.status === "ready" && candidate.slug === slug,
    );
    return record ? structuredClone(record) : null;
  }

  async claim(id: string, leaseToken: string, staleBefore: Date, now: Date) {
    const record = this.records.get(id);
    if (
      record?.status === "generating" &&
      record.attemptCount >= MAX_GENERATION_ATTEMPTS &&
      (!record.leaseAcquiredAt || record.leaseAcquiredAt < staleBefore)
    ) {
      Object.assign(record, {
        status: "failed" as const,
        safeError: GENERATION_FAILURE_MESSAGE,
        leaseToken: null,
        leaseAcquiredAt: null,
        updatedAt: now,
      });
    }

    if (
      !record ||
      record.status === "ready" ||
      record.attemptCount >= MAX_GENERATION_ATTEMPTS ||
      (record.status === "generating" &&
        record.leaseAcquiredAt &&
        record.leaseAcquiredAt >= staleBefore)
    ) {
      return null;
    }
    Object.assign(record, {
      status: "generating" as const,
      leaseToken,
      leaseAcquiredAt: now,
      safeError: null,
      attemptCount: record.attemptCount + 1,
      updatedAt: now,
    });
    return structuredClone(record);
  }

  async saveCheckpoint(
    id: string,
    leaseToken: string,
    data: NormalizedRestaurant,
    now: Date,
  ) {
    const record = this.records.get(id);
    if (record?.status !== "generating" || record.leaseToken !== leaseToken) {
      return false;
    }
    record.providerCheckpoint = structuredClone(data);
    record.updatedAt = now;
    return true;
  }

  async publish(
    id: string,
    leaseToken: string,
    slug: string,
    data: NormalizedRestaurant,
    now: Date,
  ) {
    const record = this.records.get(id);
    if (record?.status !== "generating" || record.leaseToken !== leaseToken) {
      return null;
    }
    if (this.interruptPublication) {
      this.interruptPublication = false;
      record.leaseToken = randomUUID();
      return null;
    }
    Object.assign(record, {
      status: "ready" as const,
      publishedData: structuredClone(data),
      slug,
      leaseToken: null,
      leaseAcquiredAt: null,
      updatedAt: now,
    });
    return structuredClone(record);
  }

  async fail(id: string, leaseToken: string, safeError: string, now: Date) {
    const record = this.records.get(id);
    if (record?.leaseToken !== leaseToken) return;
    Object.assign(record, {
      status: "failed" as const,
      safeError,
      leaseToken: null,
      leaseAcquiredAt: null,
      updatedAt: now,
    });
  }

  async saveMenuOutcome(
    id: string,
    status: "published" | "none" | "failed",
    menu: Menu | null,
    safeError: string | null,
    now: Date,
  ) {
    const record = this.records.get(id);
    if (record?.status !== "ready") return false;
    Object.assign(record, {
      menuStatus: status,
      menuData: menu ? structuredClone(menu) : null,
      menuSafeError: safeError,
      updatedAt: now,
    });
    return true;
  }
}
