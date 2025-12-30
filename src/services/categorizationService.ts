import type { Transaction, Rule, Category } from '../models/types';
import { db } from './database';
import { calculateConfidence } from '../utils/helpers';

/**
 * Built-in categorization rules based on common vendors
 */
const DEFAULT_CATEGORIZATION_RULES: Record<string, string[]> = {
  'cat-groceries': [
    'walmart', 'target', 'costco', 'kroger', 'safeway', 'whole foods',
    'trader joe', 'aldi', 'publix', 'wegmans', 'food lion', 'heb',
  ],
  'cat-dining': [
    'starbucks', 'mcdonald', 'chipotle', 'subway', 'taco bell', 'pizza',
    'restaurant', 'cafe', 'coffee', 'burger', 'doordash', 'uber eats',
    'grubhub', 'postmates', 'dunkin',
  ],
  'cat-transportation': [
    'uber', 'lyft', 'shell', 'chevron', 'exxon', 'bp', 'mobil',
    'parking', 'metro', 'transit', 'gas station', 'fuel',
  ],
  'cat-entertainment': [
    'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'amazon prime',
    'apple music', 'youtube', 'movie', 'theater', 'cinema', 'concert',
    'ticketmaster', 'steam', 'playstation', 'xbox',
  ],
  'cat-shopping': [
    'amazon', 'ebay', 'etsy', 'best buy', 'apple store', 'nike',
    'clothing', 'mall', 'department store', 'fashion',
  ],
  'cat-utilities': [
    'electric', 'power', 'water', 'gas', 'internet', 'phone',
    'at&t', 'verizon', 't-mobile', 'comcast', 'spectrum',
  ],
  'cat-healthcare': [
    'pharmacy', 'cvs', 'walgreens', 'hospital', 'doctor', 'dental',
    'medical', 'clinic', 'health',
  ],
  'cat-income': [
    'salary', 'payroll', 'deposit', 'direct dep', 'income', 'payment received',
  ],
};

/**
 * Categorize a single transaction
 */
export async function categorizeTransaction(
  transaction: Transaction,
  _categories: Category[],
  rules: Rule[]
): Promise<{ categoryId: string; confidence: number; reason: string }> {
  const vendor = transaction.normalizedVendor.toLowerCase();
  const description = (transaction.description || '').toLowerCase();
  const searchText = `${vendor} ${description}`;

  // Check custom rules first (highest priority)
  const matchingRule = rules
    .filter(r => r.isActive)
    .sort((a, b) => b.priority - a.priority)
    .find(rule => {
      if (rule.type === 'vendor') {
        const value = String(rule.condition.value).toLowerCase();
        switch (rule.condition.operator) {
          case 'equals':
            return vendor === value;
          case 'contains':
            return vendor.includes(value);
          case 'startsWith':
            return vendor.startsWith(value);
          case 'regex':
            try {
              return new RegExp(value).test(vendor);
            } catch {
              return false;
            }
        }
      }
      return false;
    });

  if (matchingRule?.action.categoryId) {
    return {
      categoryId: matchingRule.action.categoryId,
      confidence: calculateConfidence({
        ruleMatch: true,
        vendorMatch: true,
      }),
      reason: 'Matched custom rule',
    };
  }

  // Check built-in categorization rules
  for (const [categoryId, keywords] of Object.entries(DEFAULT_CATEGORIZATION_RULES)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return {
          categoryId,
          confidence: calculateConfidence({
            vendorMatch: true,
          }),
          reason: `Matched keyword: ${keyword}`,
        };
      }
    }
  }

  // Check historical data
  const historicalCategory = await findHistoricalCategory(vendor);
  if (historicalCategory) {
    return {
      categoryId: historicalCategory.categoryId,
      confidence: calculateConfidence({
        vendorMatch: true,
        historicalAccuracy: historicalCategory.accuracy,
      }),
      reason: 'Based on historical data',
    };
  }

  // Default to uncategorized
  return {
    categoryId: 'cat-uncategorized',
    confidence: 0,
    reason: 'No matching rules found',
  };
}

/**
 * Find historical category for a vendor
 */
async function findHistoricalCategory(
  vendor: string
): Promise<{ categoryId: string; accuracy: number } | null> {
  const historicalTransactions = await db.transactions
    .where('normalizedVendor')
    .equals(vendor)
    .filter(t => t.categoryId !== 'cat-uncategorized' && t.categoryId !== null)
    .toArray();

  if (historicalTransactions.length === 0) return null;

  // Count category occurrences
  const categoryCounts = new Map<string, number>();
  for (const t of historicalTransactions) {
    if (t.categoryId) {
      categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) || 0) + 1);
    }
  }

  // Find most common category
  let maxCount = 0;
  let mostCommonCategory = '';

  for (const [categoryId, count] of categoryCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonCategory = categoryId;
    }
  }

  if (!mostCommonCategory) return null;

  const accuracy = maxCount / historicalTransactions.length;

  return { categoryId: mostCommonCategory, accuracy };
}

/**
 * Batch categorize multiple transactions
 */
export async function categorizeTransactions(
  transactions: Transaction[]
): Promise<Transaction[]> {
  const categories = await db.categories.toArray();
  const rules = await db.rules.where('isActive').equals(1).toArray();

  const categorizedTransactions = await Promise.all(
    transactions.map(async (transaction) => {
      if (transaction.categoryId && transaction.categoryId !== 'cat-uncategorized') {
        // Already categorized, skip
        return transaction;
      }

      const { categoryId, confidence } = await categorizeTransaction(
        transaction,
        categories,
        rules
      );

      return {
        ...transaction,
        categoryId,
        confidence,
      };
    })
  );

  return categorizedTransactions;
}

/**
 * Learn from user correction and create a rule
 */
export async function learnFromCorrection(
  transactionId: string,
  newCategoryId: string,
  createRule: boolean = false
): Promise<void> {
  const transaction = await db.transactions.get(transactionId);
  if (!transaction) return;

  // Update the transaction
  await db.transactions.update(transactionId, {
    categoryId: newCategoryId,
    confidence: 1,
    updatedAt: new Date(),
  });

  // Optionally create a rule
  if (createRule) {
    const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await db.rules.add({
      id: ruleId,
      type: 'vendor',
      condition: {
        field: 'normalizedVendor',
        operator: 'equals',
        value: transaction.normalizedVendor,
      },
      action: {
        type: 'categorize',
        categoryId: newCategoryId,
      },
      priority: 100,
      isActive: true,
      learnedFromTransactionId: transactionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

/**
 * Generate spending insights using AI-like analysis
 */
export function generateInsights(
  transactions: Transaction[],
  categories: Category[]
): string[] {
  const insights: string[] = [];

  // Group by category
  const categorySpending = new Map<string, number>();
  const categoryCount = new Map<string, number>();

  for (const txn of transactions) {
    if (txn.categoryId) {
      categorySpending.set(
        txn.categoryId,
        (categorySpending.get(txn.categoryId) || 0) + txn.amount
      );
      categoryCount.set(
        txn.categoryId,
        (categoryCount.get(txn.categoryId) || 0) + 1
      );
    }
  }

  // Find top spending categories
  const topCategories = Array.from(categorySpending.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topCategories.length > 0) {
    const [topCat, topAmount] = topCategories[0];
    const category = categories.find(c => c.id === topCat);
    if (category) {
      insights.push(
        `Your highest spending is in ${category.name} with $${topAmount.toFixed(2)}`
      );
    }
  }

  // Average transaction amount
  const avgAmount = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
  insights.push(`Your average transaction is $${avgAmount.toFixed(2)}`);

  // Find unusual transactions (more than 3x average)
  const unusualTxns = transactions.filter(t => t.amount > avgAmount * 3);
  if (unusualTxns.length > 0) {
    insights.push(
      `You have ${unusualTxns.length} unusual transaction${unusualTxns.length > 1 ? 's' : ''} exceeding 3x your average`
    );
  }

  return insights;
}
