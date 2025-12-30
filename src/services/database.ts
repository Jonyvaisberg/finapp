import Dexie, { type Table } from 'dexie';
import type {
  Transaction,
  Category,
  Rule,
  Insight,
  UndoAction,
  Budget,
  ImportSession,
} from '../models/types';

/**
 * Local-first database using IndexedDB
 */
class FinanceDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  rules!: Table<Rule, string>;
  insights!: Table<Insight, string>;
  undoActions!: Table<UndoAction, string>;
  budgets!: Table<Budget, string>;
  importSessions!: Table<ImportSession, string>;

  constructor() {
    super('FinanceAppDB');

    this.version(1).stores({
      transactions: 'id, date, vendor, normalizedVendor, categoryId, source, createdAt, duplicateCheckHash',
      categories: 'id, name, isDefault, parentCategoryId',
      rules: 'id, type, priority, isActive',
      insights: 'id, type, categoryId, createdAt, isRead',
      undoActions: 'id, entity, timestamp',
      budgets: 'id, categoryId, period, startDate',
      importSessions: 'id, status, createdAt',
    });
  }
}

export const db = new FinanceDatabase();

/**
 * Initialize database with default categories
 */
export async function initializeDefaultData() {
  const categoryCount = await db.categories.count();

  if (categoryCount === 0) {
    const defaultCategories: Category[] = [
      {
        id: 'cat-uncategorized',
        name: 'Uncategorized',
        color: '#9CA3AF',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-groceries',
        name: 'Groceries',
        color: '#10B981',
        icon: '🛒',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-dining',
        name: 'Dining',
        color: '#F59E0B',
        icon: '🍽️',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-transportation',
        name: 'Transportation',
        color: '#3B82F6',
        icon: '🚗',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-entertainment',
        name: 'Entertainment',
        color: '#8B5CF6',
        icon: '🎬',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-shopping',
        name: 'Shopping',
        color: '#EC4899',
        icon: '🛍️',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-utilities',
        name: 'Utilities',
        color: '#6366F1',
        icon: '⚡',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-healthcare',
        name: 'Healthcare',
        color: '#EF4444',
        icon: '🏥',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'cat-income',
        name: 'Income',
        color: '#059669',
        icon: '💰',
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.categories.bulkAdd(defaultCategories);
  }
}

/**
 * Helper functions for database operations
 */

// Transaction operations
export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  const newTransaction: Transaction = {
    ...transaction,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await db.transactions.add(newTransaction);
  return newTransaction;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  await db.transactions.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

export async function getTransactions(filters?: {
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  vendor?: string;
}) {
  let query = db.transactions.toCollection();

  if (filters?.startDate) {
    query = query.filter(t => t.date >= filters.startDate!);
  }
  if (filters?.endDate) {
    query = query.filter(t => t.date <= filters.endDate!);
  }
  if (filters?.categoryId) {
    query = query.filter(t => t.categoryId === filters.categoryId);
  }
  if (filters?.vendor) {
    query = query.filter(t =>
      t.normalizedVendor.toLowerCase().includes(filters.vendor!.toLowerCase())
    );
  }

  return query.reverse().sortBy('date');
}

// Category operations
export async function addCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  const newCategory: Category = {
    ...category,
    id,
    createdAt: now,
    updatedAt: now,
    isDefault: false,
  };

  await db.categories.add(newCategory);
  return newCategory;
}

export async function updateCategory(id: string, updates: Partial<Category>) {
  await db.categories.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteCategory(id: string) {
  // Move all transactions in this category to uncategorized
  const transactions = await db.transactions.where('categoryId').equals(id).toArray();
  await Promise.all(
    transactions.map(t => updateTransaction(t.id, { categoryId: 'cat-uncategorized' }))
  );

  await db.categories.delete(id);
}

export async function getCategories() {
  return db.categories.toArray();
}

// Rule operations
export async function addRule(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  const newRule: Rule = {
    ...rule,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await db.rules.add(newRule);
  return newRule;
}

export async function getActiveRules() {
  return db.rules.where('isActive').equals(1).sortBy('priority');
}

// Undo operations
export async function addUndoAction(action: Omit<UndoAction, 'id' | 'timestamp'>) {
  const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const undoAction: UndoAction = {
    ...action,
    id,
    timestamp: new Date(),
  };

  await db.undoActions.add(undoAction);

  // Keep only last 50 undo actions
  const count = await db.undoActions.count();
  if (count > 50) {
    const oldest = await db.undoActions.orderBy('timestamp').limit(count - 50).toArray();
    await db.undoActions.bulkDelete(oldest.map(a => a.id));
  }

  return undoAction;
}

export async function getLatestUndoAction() {
  return db.undoActions.orderBy('timestamp').reverse().first();
}
