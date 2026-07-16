export type SubmissionFormState = {
  sourceUrl: string;
  error: string | null;
};

export const INITIAL_SUBMISSION_STATE: SubmissionFormState = {
  sourceUrl: "",
  error: null,
};
