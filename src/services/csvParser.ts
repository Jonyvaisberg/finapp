import Papa from 'papaparse';
import type { Transaction } from '../models/types';
import { normalizeVendor, generateDuplicateHash } from '../utils/helpers';

export interface CSVParseResult {
  transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[];
  errors: string[];
  duplicates: number;
}

interface CSVRow {
  [key: string]: string;
}

/**
 * Detect CSV format and map columns
 */
function detectCSVFormat(headers: string[]): {
  dateField: string | null;
  amountField: string | null;
  vendorField: string | null;
  descriptionField: string | null;
} {
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Date field detection
  const datePatterns = ['date', 'transaction date', 'posted date', 'trans date'];
  const dateField = headers.find((_, i) =>
    datePatterns.some(pattern => lowerHeaders[i].includes(pattern))
  ) || null;

  // Amount field detection
  const amountPatterns = ['amount', 'debit', 'withdrawal', 'transaction amount'];
  const amountField = headers.find((_, i) =>
    amountPatterns.some(pattern => lowerHeaders[i].includes(pattern))
  ) || null;

  // Vendor field detection
  const vendorPatterns = ['description', 'merchant', 'vendor', 'payee', 'name'];
  const vendorField = headers.find((_, i) =>
    vendorPatterns.some(pattern => lowerHeaders[i].includes(pattern))
  ) || null;

  // Description field (secondary)
  const descriptionField = headers.find((_, i) =>
    lowerHeaders[i].includes('memo') || lowerHeaders[i].includes('notes')
  ) || null;

  return { dateField, amountField, vendorField, descriptionField };
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;

  // Try MM/DD/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    date = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD/MM/YYYY
  if (parts.length === 3) {
    date = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Parse amount from string
 */
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;

  // Remove currency symbols and commas
  const cleaned = amountStr.replace(/[$,€£¥]/g, '').trim();

  // Handle parentheses as negative
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    return -parseFloat(cleaned.slice(1, -1));
  }

  return parseFloat(cleaned) || 0;
}

/**
 * Parse CSV file and extract transactions
 */
export async function parseCSVFile(
  file: File,
  existingHashes: Set<string> = new Set()
): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    const transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: string[] = [];
    let duplicates = 0;

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          errors.push(...results.errors.map(e => `Row ${e.row}: ${e.message}`));
        }

        const headers = results.meta.fields || [];
        const mapping = detectCSVFormat(headers);

        if (!mapping.dateField || !mapping.amountField || !mapping.vendorField) {
          errors.push(
            'Could not detect required fields. Please ensure CSV has date, amount, and vendor/description columns.'
          );
          resolve({ transactions, errors, duplicates });
          return;
        }

        results.data.forEach((row, index) => {
          try {
            const date = parseDate(row[mapping.dateField!]);
            const amount = parseAmount(row[mapping.amountField!]);
            const vendor = row[mapping.vendorField!]?.trim() || 'Unknown';
            const description = mapping.descriptionField
              ? row[mapping.descriptionField]?.trim()
              : undefined;

            if (!date) {
              errors.push(`Row ${index + 2}: Invalid date format`);
              return;
            }

            if (amount === 0) {
              // Skip zero amount transactions
              return;
            }

            const normalizedVendor = normalizeVendor(vendor);
            const duplicateCheckHash = generateDuplicateHash(date, amount, vendor);

            // Check for duplicates
            if (existingHashes.has(duplicateCheckHash)) {
              duplicates++;
              return;
            }

            existingHashes.add(duplicateCheckHash);

            transactions.push({
              date,
              amount: Math.abs(amount),
              vendor,
              normalizedVendor,
              description,
              categoryId: null,
              confidence: 0,
              source: 'csv',
              originalData: row,
              isReconciled: false,
              duplicateCheckHash,
            });
          } catch (error) {
            errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });

        resolve({ transactions, errors, duplicates });
      },
      error: (error) => {
        errors.push(`Parse error: ${error.message}`);
        resolve({ transactions, errors, duplicates });
      },
    });
  });
}

/**
 * Export transactions to CSV
 */
export function exportToCSV(transactions: Transaction[]): string {
  const headers = ['Date', 'Vendor', 'Amount', 'Category', 'Description'];

  const rows = transactions.map(t => [
    t.date.toISOString().split('T')[0],
    t.vendor,
    t.amount.toFixed(2),
    t.categoryId || 'Uncategorized',
    t.description || '',
  ]);

  return Papa.unparse({
    fields: headers,
    data: rows,
  });
}
