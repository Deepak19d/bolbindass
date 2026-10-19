// Sarvam AI is an OPTIONAL paid service. BolBindass never calls it.
//
// Why: Sarvam's own docs (checked Oct 2026) list a one-time ₹100 credit for
// new accounts and paid per-use pricing after that (e.g. ₹30/hour of
// speech-to-text, ₹30 per 10K characters of text-to-speech). There is no
// public endpoint to read the remaining balance, so the only way to "check"
// would be a billable request. To guarantee ₹0, the integration stays off and
// this module only reports whether a key is present — it never returns,
// logs or forwards the key.

export interface SarvamStatus {
  keyConfigured: boolean;
  enabled: false;
  freeCreditsVerified: false;
  reason: string;
}

export function getSarvamStatus(env: Record<string, string | undefined> = process.env): SarvamStatus {
  const keyConfigured = Boolean(env.SARVAM_API_KEY && env.SARVAM_API_KEY.trim().length > 0);
  return {
    keyConfigured,
    enabled: false,
    freeCreditsVerified: false,
    reason: keyConfigured
      ? "A Sarvam key is set for this app, but BolBindass never uses it: your remaining free credit can't be checked without making a billable request, so Sarvam stays switched off to guarantee ₹0."
      : "No Sarvam key is configured — and none is needed. BolBindass works fully with your browser's voice features and a local Ollama model.",
  };
}
