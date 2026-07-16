"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import type { PublicGenerationStatus } from "@/domain/generation/public-status";

const POLL_INTERVAL_MS = 1_500;
const DELAYED_AFTER_MS = 30_000;

export function GenerationProgress({
  id,
  initialStatus,
  navigate = (url) => window.location.assign(url),
}: {
  id: string;
  initialStatus: PublicGenerationStatus;
  navigate?: (url: string) => void;
}) {
  const [generation, setGeneration] = useState(initialStatus);
  const [delayed, setDelayed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const applyStatus = useEffectEvent((status: PublicGenerationStatus) => {
    setGeneration(status);
    if (status.status === "ready" && status.slug) {
      navigate(`/r/${status.slug}`);
    }
  });

  useEffect(() => {
    void retryKey;
    if (
      delayed ||
      generation.status === "ready" ||
      generation.status === "failed"
    )
      return;

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout>;
    const delayedTimer = setTimeout(() => {
      if (active) setDelayed(true);
    }, DELAYED_AFTER_MS);

    async function request(path: string, init?: RequestInit) {
      const response = await fetch(path, { ...init, cache: "no-store" });
      if (!response.ok) throw new Error("Generation request failed");
      if (active) applyStatus(await response.json());
    }

    async function poll() {
      try {
        await request(`/api/generations/${id}`);
      } catch {
        // A transient disconnect is recoverable because status is persisted.
      } finally {
        if (active) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    void request(`/api/generations/${id}/progress`, { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        if (active) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      });

    return () => {
      active = false;
      clearTimeout(delayedTimer);
      clearTimeout(pollTimer);
    };
  }, [id, retryKey, delayed, generation.status, applyStatus]);

  const retry = () => {
    setDelayed(false);
    setGeneration({ status: "pending", slug: null, error: null });
    setRetryKey((value) => value + 1);
  };

  if (generation.status === "failed") {
    return (
      <div className="generation-state" role="alert">
        <p className="error">
          {generation.error ?? "We couldn't finish your site."}
        </p>
        <div className="generation-actions">
          <button className="primary-button" onClick={retry} type="button">
            Try again
          </button>
          <Link href="/">Use another link</Link>
        </div>
      </div>
    );
  }

  if (delayed) {
    return (
      <output className="generation-state" aria-live="polite">
        <h2>This is taking longer than usual.</h2>
        <p>
          Your progress is saved. You can resume safely now or return later.
        </p>
        <div className="generation-actions">
          <button className="primary-button" onClick={retry} type="button">
            Resume
          </button>
          <Link href="/">Use another link</Link>
        </div>
      </output>
    );
  }

  return (
    <output className="generation-state" aria-live="polite">
      <ol className="progress-stages" aria-label="Generation progress">
        <li data-active={generation.status === "pending"}>
          Checking your link
        </li>
        <li data-active={generation.status === "generating"}>
          Building your page
        </li>
        <li data-active={generation.status === "ready"}>Opening your site</li>
      </ol>
      <p className="keep-open">Keep this page open while we build your site.</p>
    </output>
  );
}
