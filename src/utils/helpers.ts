/**
 * Utility functions for the finance app
 */

/**
 * Normalize vendor names for better categorization
 */
export function normalizeVendor(vendor: string): string {
  if (!vendor) return 'Unknown';

  let normalized = vendor.toUpperCase().trim();

  // Remove common payment processors
  normalized = normalized
    .replace(/\bSQ\s*\*/gi, '') // Square
    .replace(/\bTST\s*\*/gi, '') // Toast
    .replace(/\bSP\s*\*/gi, '') // Stripe
    .replace(/\bPP\s*\*/gi, '') // PayPal
    .trim();

  // Remove location codes and store numbers
  normalized = normalized
    .replace(/#\d+/g, '')
    .replace(/\bSTORE\s*\d+/gi, '')
    .replace(/\bLOC\s*\d+/gi, '')
    .trim();

  // Remove dates and reference numbers
  normalized = normalized
    .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '')
    .replace(/\d{2}-\d{2}-\d{2,4}/g, '')
    .replace(/REF#\d+/gi, '')
    .trim();

  // Common replacements
  const replacements: Record<string, string> = {
    'STARBUCKS': 'Starbucks',
    'AMAZON': 'Amazon',
    'WALMART': 'Walmart',
    'TARGET': 'Target',
    'UBER': 'Uber',
    'LYFT': 'Lyft',
    'NETFLIX': 'Netflix',
    'SPOTIFY': 'Spotify',
    'APPLE.COM': 'Apple',
    'GOOGLE': 'Google',
  };

  for (const [key, value] of Object.entries(replacements)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Capitalize first letter of each word
  return normalized
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate a hash for duplicate detection
 */
export function generateDuplicateHash(date: Date, amount: number, vendor: string): string {
  const dateStr = date.toISOString().split('T')[0];
  const amountStr = amount.toFixed(2);
  const vendorStr = vendor.toLowerCase().replace(/\s+/g, '');

  return `${dateStr}-${amountStr}-${vendorStr}`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Calculate date range for period
 */
export function getDateRangeForPeriod(period: 'week' | 'month' | 'year' | 'all'): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2000, 0, 1);
      break;
  }

  return { start, end };
}

/**
 * Get color for category
 */
export function getCategoryColor(index: number): string {
  const colors = [
    '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899',
    '#06B6D4', '#EF4444', '#14B8A6', '#F97316', '#6366F1',
  ];

  return colors[index % colors.length];
}

/**
 * Calculate confidence score based on multiple factors
 */
export function calculateConfidence(factors: {
  ruleMatch?: boolean;
  vendorMatch?: boolean;
  amountMatch?: boolean;
  historicalAccuracy?: number;
}): number {
  let confidence = 0;

  if (factors.ruleMatch) confidence += 0.4;
  if (factors.vendorMatch) confidence += 0.3;
  if (factors.amountMatch) confidence += 0.2;
  if (factors.historicalAccuracy) confidence += factors.historicalAccuracy * 0.1;

  return Math.min(confidence, 1);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
