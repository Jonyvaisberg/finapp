import { create } from 'zustand';
import type { Transaction, Category, Rule, Insight } from '../models/types';
import { db, getTransactions, getCategories } from '../services/database';

interface AppState {
  // Data
  transactions: Transaction[];
  categories: Category[];
  rules: Rule[];
  insights: Insight[];

  // UI State
  isLoading: boolean;
  currentScreen: 'input' | 'categorization' | 'dashboard';
  selectedTransactionId: string | null;
  undoStack: string[];

  // Actions
  loadData: () => Promise<void>;
  setCurrentScreen: (screen: 'input' | 'categorization' | 'dashboard') => void;
  addTransactions: (transactions: Transaction[]) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  mergeCategories: (sourceIds: string[], targetId: string) => Promise<void>;
  setSelectedTransaction: (id: string | null) => void;
  refreshTransactions: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  transactions: [],
  categories: [],
  rules: [],
  insights: [],
  isLoading: false,
  currentScreen: 'dashboard',
  selectedTransactionId: null,
  undoStack: [],

  // Load all data from IndexedDB
  loadData: async () => {
    set({ isLoading: true });
    try {
      const [transactions, categories, rules, insights] = await Promise.all([
        getTransactions(),
        getCategories(),
        db.rules.toArray(),
        db.insights.toArray(),
      ]);

      set({
        transactions,
        categories,
        rules,
        insights,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      set({ isLoading: false });
    }
  },

  setCurrentScreen: (screen) => {
    set({ currentScreen: screen });
  },

  addTransactions: async (transactions) => {
    try {
      await db.transactions.bulkAdd(transactions);
      await get().refreshTransactions();
    } catch (error) {
      console.error('Error adding transactions:', error);
      throw error;
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      await db.transactions.update(id, {
        ...updates,
        updatedAt: new Date(),
      });
      await get().refreshTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  },

  deleteTransaction: async (id) => {
    try {
      await db.transactions.delete(id);
      await get().refreshTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  },

  addCategory: async (category) => {
    try {
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
      const categories = await getCategories();
      set({ categories });
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  },

  updateCategory: async (id, updates) => {
    try {
      await db.categories.update(id, {
        ...updates,
        updatedAt: new Date(),
      });
      const categories = await getCategories();
      set({ categories });
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },

  deleteCategory: async (id) => {
    try {
      // Move all transactions to uncategorized
      const transactions = await db.transactions.where('categoryId').equals(id).toArray();
      await Promise.all(
        transactions.map(t =>
          db.transactions.update(t.id, {
            categoryId: 'cat-uncategorized',
            updatedAt: new Date(),
          })
        )
      );

      await db.categories.delete(id);
      const categories = await getCategories();
      set({ categories });
      await get().refreshTransactions();
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  mergeCategories: async (sourceIds, targetId) => {
    try {
      // Move all transactions from source categories to target
      for (const sourceId of sourceIds) {
        const transactions = await db.transactions.where('categoryId').equals(sourceId).toArray();
        await Promise.all(
          transactions.map(t =>
            db.transactions.update(t.id, {
              categoryId: targetId,
              updatedAt: new Date(),
            })
          )
        );
        await db.categories.delete(sourceId);
      }

      const categories = await getCategories();
      set({ categories });
      await get().refreshTransactions();
    } catch (error) {
      console.error('Error merging categories:', error);
      throw error;
    }
  },

  setSelectedTransaction: (id) => {
    set({ selectedTransactionId: id });
  },

  refreshTransactions: async () => {
    const transactions = await getTransactions();
    set({ transactions });
  },
}));
