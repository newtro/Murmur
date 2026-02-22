import { describe, it, expect } from 'vitest';
import { validateMistralApiKey, validateKeyFormat } from './validation';

describe('validateMistralApiKey', () => {
  it('should return valid for a correct 32-char key with uppercase, lowercase, and number', () => {
    // 25 lowercase + 1 uppercase + 6 numbers = 32
    const result = validateMistralApiKey('abcdefghijklmnopqrstuvwxyA123456');
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('should return invalid for 31 characters', () => {
    // 25 lowercase + 1 uppercase + 5 numbers = 31
    const result = validateMistralApiKey('abcdefghijklmnopqrstuvwxyA12345');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('32 characters');
  });

  it('should return invalid for 33 characters', () => {
    // 25 lowercase + 1 uppercase + 7 numbers = 33
    const result = validateMistralApiKey('abcdefghijklmnopqrstuvwxyA1234567');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('32 characters');
  });

  it('should return invalid when missing uppercase letter', () => {
    // 26 lowercase + 6 numbers = 32
    const result = validateMistralApiKey('abcdefghijklmnopqrstuvwxyz123456');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('uppercase');
  });

  it('should return invalid when missing lowercase letter', () => {
    // 26 uppercase + 6 numbers = 32
    const result = validateMistralApiKey('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('lowercase');
  });

  it('should return invalid when missing number', () => {
    // 16 lowercase + 16 uppercase = 32
    const result = validateMistralApiKey('abcdefghijklmnopABCDEFGHIJKLMNOP');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('number');
  });

  it('should trim whitespace before validation', () => {
    // 25 lowercase + 1 uppercase + 6 numbers = 32, with 2 spaces on each side
    const result = validateMistralApiKey('  abcdefghijklmnopqrstuvwxyA123456  ');
    expect(result.valid).toBe(true);
  });

  it('should return invalid for empty string', () => {
    const result = validateMistralApiKey('');
    expect(result.valid).toBe(false);
    expect(result.warning).toBe('API key is required');
  });

  it('should return invalid for whitespace only', () => {
    const result = validateMistralApiKey('   ');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('32 characters');
  });
});

describe('validateKeyFormat', () => {
  it('should return null when provider is not provided', () => {
    const result = validateKeyFormat('somekey', undefined);
    expect(result).toBeNull();
  });

  it('should return null when key is not provided', () => {
    const result = validateKeyFormat('', 'mistral');
    expect(result).toBeNull();
  });

  it('should use mistral validation for mistral provider', () => {
    const result = validateKeyFormat('abcdefghijklmnopqrstuvwxyA123456', 'mistral');
    expect(result?.valid).toBe(true);
  });

  it('should return valid for unknown providers', () => {
    const result = validateKeyFormat('anykey', 'unknown');
    expect(result?.valid).toBe(true);
  });
});
