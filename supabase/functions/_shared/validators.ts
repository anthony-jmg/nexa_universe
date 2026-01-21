export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class Validator {
  private errors: string[] = [];

  required(value: any, fieldName: string): this {
    if (value === null || value === undefined || value === '') {
      this.errors.push(`${fieldName} is required`);
    }
    return this;
  }

  string(value: any, fieldName: string): this {
    if (typeof value !== 'string') {
      this.errors.push(`${fieldName} must be a string`);
    }
    return this;
  }

  number(value: any, fieldName: string): this {
    if (typeof value !== 'number' || isNaN(value)) {
      this.errors.push(`${fieldName} must be a valid number`);
    }
    return this;
  }

  positiveNumber(value: any, fieldName: string): this {
    this.number(value, fieldName);
    if (typeof value === 'number' && value <= 0) {
      this.errors.push(`${fieldName} must be positive`);
    }
    return this;
  }

  min(value: number, min: number, fieldName: string): this {
    if (value < min) {
      this.errors.push(`${fieldName} must be at least ${min}`);
    }
    return this;
  }

  max(value: number, max: number, fieldName: string): this {
    if (value > max) {
      this.errors.push(`${fieldName} must be at most ${max}`);
    }
    return this;
  }

  minLength(value: string, min: number, fieldName: string): this {
    if (value.length < min) {
      this.errors.push(`${fieldName} must be at least ${min} characters`);
    }
    return this;
  }

  maxLength(value: string, max: number, fieldName: string): this {
    if (value.length > max) {
      this.errors.push(`${fieldName} must be at most ${max} characters`);
    }
    return this;
  }

  email(value: string, fieldName: string): this {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      this.errors.push(`${fieldName} must be a valid email address`);
    }
    return this;
  }

  url(value: string, fieldName: string): this {
    try {
      new URL(value);
    } catch {
      this.errors.push(`${fieldName} must be a valid URL`);
    }
    return this;
  }

  uuid(value: string, fieldName: string): this {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      this.errors.push(`${fieldName} must be a valid UUID`);
    }
    return this;
  }

  enum(value: any, allowedValues: any[], fieldName: string): this {
    if (!allowedValues.includes(value)) {
      this.errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
    return this;
  }

  array(value: any, fieldName: string): this {
    if (!Array.isArray(value)) {
      this.errors.push(`${fieldName} must be an array`);
    }
    return this;
  }

  arrayMinLength(value: any[], min: number, fieldName: string): this {
    if (value.length < min) {
      this.errors.push(`${fieldName} must contain at least ${min} items`);
    }
    return this;
  }

  arrayMaxLength(value: any[], max: number, fieldName: string): this {
    if (value.length > max) {
      this.errors.push(`${fieldName} must contain at most ${max} items`);
    }
    return this;
  }

  custom(condition: boolean, message: string): this {
    if (!condition) {
      this.errors.push(message);
    }
    return this;
  }

  getResult(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
    };
  }

  reset(): this {
    this.errors = [];
    return this;
  }
}

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 10000);
}

export function sanitizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function sanitizePrice(price: number): number {
  return Math.max(0, Math.round(price * 100) / 100);
}
