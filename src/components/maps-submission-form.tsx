"use client";

import { useActionState, useState } from "react";
import { submitGeneration } from "@/app/actions";
import { FIXTURE_MAPS_URL } from "@/domain/generation/fixture-provider";
import { INITIAL_SUBMISSION_STATE } from "@/domain/generation/submission-form";

export function MapsSubmissionForm() {
  const [state, formAction, pending] = useActionState(
    submitGeneration,
    INITIAL_SUBMISSION_STATE,
  );
  const [sourceUrl, setSourceUrl] = useState(state.sourceUrl);
  const visibleError = sourceUrl === state.sourceUrl ? state.error : null;
  const errorId = visibleError ? "source-error" : undefined;

  return (
    <form className="source-form" action={formAction} noValidate>
      <label htmlFor="sourceUrl">Google Maps place link</label>
      <div className="form-row">
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://maps.app.goo.gl/..."
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          aria-describedby={errorId ?? "source-note"}
          aria-invalid={Boolean(visibleError)}
          required
        />
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Checking link..." : "Create my page"}
        </button>
      </div>
      {visibleError ? (
        <p className="error" id="source-error" role="alert">
          {visibleError}
        </p>
      ) : (
        <p id="source-note">Full and shortened Google Maps place links work.</p>
      )}
      <button
        className="example-button"
        type="button"
        onClick={() => setSourceUrl(FIXTURE_MAPS_URL)}
      >
        Try the Las Palmeras example
      </button>
    </form>
  );
}
