import { describe, it, expect } from 'vitest';

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePrice(price: number): boolean {
  return typeof price === 'number' && !isNaN(price) && isFinite(price) && price >= 0;
}

function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

describe('Email Validation', () => {
  it('should validate correct email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co.uk')).toBe(true);
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@domain')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('Price Validation', () => {
  it('should validate positive numbers', () => {
    expect(validatePrice(0)).toBe(true);
    expect(validatePrice(10.99)).toBe(true);
    expect(validatePrice(1000)).toBe(true);
  });

  it('should reject negative numbers', () => {
    expect(validatePrice(-1)).toBe(false);
    expect(validatePrice(-10.99)).toBe(false);
  });

  it('should reject non-numbers', () => {
    expect(validatePrice(NaN)).toBe(false);
    expect(validatePrice(Infinity)).toBe(false);
  });
});

describe('UUID Validation', () => {
  it('should validate correct UUIDs', () => {
    expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validateUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    expect(validateUUID('invalid-uuid')).toBe(false);
    expect(validateUUID('550e8400-e29b-41d4-a716')).toBe(false);
    expect(validateUUID('')).toBe(false);
    expect(validateUUID('550e8400e29b41d4a716446655440000')).toBe(false);
  });
});
