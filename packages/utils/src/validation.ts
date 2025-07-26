export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    errors.push('Email is required');
  } else if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validatePassword(password: string, minLength: number = 8): ValidationResult {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateRequired(value: any, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (value === null || value === undefined || value === '') {
    errors.push(`${fieldName} is required`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateMinLength(value: string, minLength: number, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (value && value.length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters long`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (value && value.length > maxLength) {
    errors.push(`${fieldName} must be no more than ${maxLength} characters long`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateNumber(value: any, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (value !== null && value !== undefined && value !== '') {
    const num = Number(value);
    if (isNaN(num)) {
      errors.push(`${fieldName} must be a valid number`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateRange(value: number, min: number, max: number, fieldName: string): ValidationResult {
  const errors: string[] = [];
  
  if (value < min || value > max) {
    errors.push(`${fieldName} must be between ${min} and ${max}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  const allErrors = results.flatMap(result => result.errors);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}