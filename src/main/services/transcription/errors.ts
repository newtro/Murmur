// ============================================================================
// Transcription error classification
// ============================================================================

import { TranscriptionProvider } from '../../../shared/types';

export type TranscriptionErrorKind =
  | 'network'
  | 'auth'
  | 'rate_limit'
  | 'server'
  | 'bad_request'
  | 'unknown';

export interface ClassifiedTranscriptionError {
  kind: TranscriptionErrorKind;
  retryable: boolean;
  userMessage: string;
  provider: TranscriptionProvider;
  rawMessage: string;
}

const PROVIDER_LABELS: Record<TranscriptionProvider, string> = {
  groq: 'Groq',
  openai: 'OpenAI',
  mistral: 'Mistral',
  'whisper-local': 'local Whisper',
};

export function classifyTranscriptionError(
  error: unknown,
  provider: TranscriptionProvider
): ClassifiedTranscriptionError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const label = PROVIDER_LABELS[provider];
  const statusCode = extractStatusCode(error, rawMessage);
  const lower = rawMessage.toLowerCase();

  // Envoy/proxy upstream errors — typically 503 from a gateway in front of the provider
  if (
    lower.includes('upstream connect error') ||
    lower.includes('reset before headers') ||
    lower.includes('no healthy upstream')
  ) {
    return {
      kind: 'server',
      retryable: true,
      userMessage: `${label} is temporarily unreachable. Please try again.`,
      provider,
      rawMessage,
    };
  }

  if (statusCode === 401 || statusCode === 403 || /unauthori[sz]ed|invalid.*api.?key|forbidden/.test(lower)) {
    return {
      kind: 'auth',
      retryable: false,
      userMessage: `${label} rejected your API key. Check it in Settings.`,
      provider,
      rawMessage,
    };
  }

  if (statusCode === 429 || lower.includes('rate limit') || lower.includes('quota')) {
    return {
      kind: 'rate_limit',
      retryable: true,
      userMessage: `${label} rate limit hit. Please wait a moment and try again.`,
      provider,
      rawMessage,
    };
  }

  if (statusCode !== undefined && statusCode >= 500) {
    return {
      kind: 'server',
      retryable: true,
      userMessage: `${label} server error (${statusCode}). Please try again.`,
      provider,
      rawMessage,
    };
  }

  if (statusCode === 400 || statusCode === 404 || statusCode === 422) {
    return {
      kind: 'bad_request',
      retryable: false,
      userMessage: `${label} rejected the request. The selected model may be unavailable.`,
      provider,
      rawMessage,
    };
  }

  if (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return {
      kind: 'network',
      retryable: true,
      userMessage: `Can't reach ${label}. Check your internet connection.`,
      provider,
      rawMessage,
    };
  }

  return {
    kind: 'unknown',
    retryable: true,
    userMessage: `${label} transcription failed. Please try again.`,
    provider,
    rawMessage,
  };
}

function extractStatusCode(error: unknown, message: string): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const e = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } };
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
    if (e.response && typeof e.response.status === 'number') return e.response.status;
  }
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}
