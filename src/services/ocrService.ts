import { createWorker } from 'tesseract.js';
import type { Transaction } from '../models/types';
import { normalizeVendor, generateDuplicateHash } from '../utils/helpers';

export interface OCRResult {
  transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[];
  errors: string[];
  rawText: string;
}

/**
 * Extract text from receipt image using OCR
 */
export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  const { data } = await worker.recognize(imageFile);
  await worker.terminate();

  return data.text;
}

/**
 * Parse receipt text and extract transaction details
 */
export function parseReceiptText(text: string): OCRResult {
  const transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: string[] = [];

  try {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

    // Extract merchant name (usually at the top)
    let merchant = 'Unknown Merchant';
    if (lines.length > 0) {
      merchant = lines[0];
      // Clean up merchant name
      merchant = merchant.replace(/[^a-zA-Z0-9\s&]/g, '').trim();
    }

    // Look for date pattern (MM/DD/YYYY, DD/MM/YYYY, etc.)
    let date: Date | null = null;
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
      /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
      /(\d{4})-(\d{2})-(\d{2})/,
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          try {
            if (pattern === datePatterns[2]) {
              // ISO format
              date = new Date(match[0]);
            } else {
              // Try MM/DD/YYYY first
              const [_, first, second, year] = match;
              const fullYear = year.length === 2 ? `20${year}` : year;
              date = new Date(`${fullYear}-${first.padStart(2, '0')}-${second.padStart(2, '0')}`);

              // If date is invalid, try DD/MM/YYYY
              if (isNaN(date.getTime())) {
                date = new Date(`${fullYear}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`);
              }
            }

            if (!isNaN(date.getTime())) break;
          } catch {
            // Continue searching
          }
        }
      }
      if (date && !isNaN(date.getTime())) break;
    }

    if (!date || isNaN(date.getTime())) {
      date = new Date(); // Default to today
      errors.push('Could not detect date on receipt, using current date');
    }

    // Look for total amount (usually labeled as TOTAL, AMOUNT DUE, etc.)
    let totalAmount = 0;
    const amountPatterns = [
      /(?:total|amount\s*due|balance)\s*:?\s*\$?\s*(\d+[.,]\d{2})/i,
      /\$\s*(\d+[.,]\d{2})\s*(?:total|amount)/i,
    ];

    for (const line of lines) {
      for (const pattern of amountPatterns) {
        const match = line.match(pattern);
        if (match) {
          totalAmount = parseFloat(match[1].replace(',', '.'));
          if (totalAmount > 0) break;
        }
      }
      if (totalAmount > 0) break;
    }

    // If no labeled total found, look for largest amount
    if (totalAmount === 0) {
      const amounts = lines
        .map(line => {
          const match = line.match(/\$?\s*(\d+[.,]\d{2})/);
          return match ? parseFloat(match[1].replace(',', '.')) : 0;
        })
        .filter(amt => amt > 0);

      if (amounts.length > 0) {
        totalAmount = Math.max(...amounts);
      }
    }

    if (totalAmount === 0) {
      errors.push('Could not detect amount on receipt');
      return { transactions, errors, rawText: text };
    }

    const normalizedVendor = normalizeVendor(merchant);
    const duplicateCheckHash = generateDuplicateHash(date, totalAmount, merchant);

    transactions.push({
      date,
      amount: totalAmount,
      vendor: merchant,
      normalizedVendor,
      description: 'Receipt upload',
      categoryId: null,
      confidence: 0.5, // OCR has moderate confidence
      source: 'receipt',
      isReconciled: false,
      duplicateCheckHash,
    });

  } catch (error) {
    errors.push(`Error parsing receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { transactions, errors, rawText: text };
}

/**
 * Process receipt image end-to-end
 */
export async function processReceiptImage(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  try {
    const text = await extractTextFromImage(imageFile, onProgress);
    return parseReceiptText(text);
  } catch (error) {
    return {
      transactions: [],
      errors: [`Failed to process receipt: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rawText: '',
    };
  }
}
