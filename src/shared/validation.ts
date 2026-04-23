export interface ValidationResult {
  valid: boolean;
  warning?: string;
}

export function validateMistralApiKey(key: string): ValidationResult {
  if (!key) {
    return { valid: false, warning: 'API key is required' };
  }

  const trimmedKey = key.trim();

  if (trimmedKey.length !== 32) {
    return { valid: false, warning: 'API key should be 32 characters long. This may not be a valid Mistral API key.' };
  }
  if (!/[A-Z]/.test(trimmedKey)) {
    return { valid: false, warning: 'API key should contain at least 1 uppercase letter. This may not be a valid Mistral API key.' };
  }
  if (!/[a-z]/.test(trimmedKey)) {
    return { valid: false, warning: 'API key should contain at least 1 lowercase letter. This may not be a valid Mistral API key.' };
  }
  if (!/[0-9]/.test(trimmedKey)) {
    return { valid: false, warning: 'API key should contain at least 1 number. This may not be a valid Mistral API key.' };
  }

  return { valid: true };
}

export function validateKeyFormat(
  key: string,
  provider: string | undefined
): ValidationResult | null {
  if (!provider || !key) return null;

  if (provider === 'mistral') {
    return validateMistralApiKey(key);
  }

  return { valid: true };
}
