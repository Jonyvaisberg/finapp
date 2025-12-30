/**
 * Core data models for the personal finance app
 */

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  vendor: string;
  normalizedVendor: string;
  description?: string;
  categoryId: string | null;
  confidence: number; // 0-1, AI confidence in categorization
  source: 'csv' | 'receipt' | 'manual';
  originalData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  isReconciled: boolean;
  duplicateCheckHash?: string; // For deduplication
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  plannedAmount?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  parentCategoryId?: string | null;
}

export interface Rule {
  id: string;
  type: 'vendor' | 'amount' | 'description' | 'custom';
  condition: {
    field: string;
    operator: 'equals' | 'contains' | 'startsWith' | 'regex' | 'range';
    value: string | number | [number, number];
  };
  action: {
    type: 'categorize' | 'normalize';
    categoryId?: string;
    normalizedName?: string;
  };
  priority: number;
  isActive: boolean;
  learnedFromTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Insight {
  id: string;
  type: 'spending_trend' | 'budget_alert' | 'unusual_transaction' | 'category_comparison';
  message: string;
  severity: 'info' | 'warning' | 'success';
  categoryId?: string;
  amount?: number;
  createdAt: Date;
  isRead: boolean;
}

export interface UndoAction {
  id: string;
  type: 'create' | 'update' | 'delete' | 'bulk_update';
  entity: 'transaction' | 'category' | 'rule';
  before: unknown;
  after: unknown;
  timestamp: Date;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportSession {
  id: string;
  fileName: string;
  fileType: 'csv' | 'image';
  status: 'processing' | 'completed' | 'failed';
  totalTransactions: number;
  processedTransactions: number;
  duplicatesFound: number;
  errors: string[];
  createdAt: Date;
  completedAt?: Date;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  totalSpent: number;
  plannedAmount?: number;
  delta?: number;
  transactionCount: number;
  percentage: number;
  color: string;
}

export interface SpendingInsight {
  message: string;
  type: 'trend' | 'comparison' | 'alert';
  data?: Record<string, unknown>;
}

export interface NLCommand {
  command: string;
  intent: 'merge_categories' | 'create_category' | 'move_transactions' | 'create_rule' | 'set_budget' | 'unknown';
  entities: {
    categories?: string[];
    vendor?: string;
    amount?: number;
    transactions?: string[];
  };
  confidence: number;
}
