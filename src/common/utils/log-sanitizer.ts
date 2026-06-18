export class LogSanitizer {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'pin',
    'ssn',
    'creditCard',
    'cardNumber',
  ];

  static sanitize(data: any, maxDepth: number = 10): any {
    return this.sanitizeRecursive(data, maxDepth, 0);
  }

  private static sanitizeRecursive(data: any, maxDepth: number, currentDepth: number): any {
    if (currentDepth >= maxDepth) return '[MAX_DEPTH_REACHED]';
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeRecursive(item, maxDepth, currentDepth + 1));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.isSensitiveField(key)) {
        result[key] = '********';
      } else if (typeof value === 'object') {
        result[key] = this.sanitizeRecursive(value, maxDepth, currentDepth + 1);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private static isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.SENSITIVE_FIELDS.some((sensitive) => lowerField.includes(sensitive));
  }
}
