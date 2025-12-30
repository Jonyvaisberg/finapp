import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { CategorySpending } from '../models/types';
import { formatCurrency } from '../utils/helpers';
import { generateInsights } from '../services/categorizationService';

type Period = 'week' | 'month' | 'year' | 'all';

export function DashboardScreen() {
  const { transactions, categories } = useStore();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');

  // Filter transactions by period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const start = new Date();

    switch (selectedPeriod) {
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

    return transactions.filter((t) => new Date(t.date) >= start && new Date(t.date) <= now);
  }, [transactions, selectedPeriod]);

  // Calculate category spending
  const categorySpending = useMemo<CategorySpending[]>(() => {
    const spendingMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    filteredTransactions.forEach((txn) => {
      const categoryId = txn.categoryId || 'cat-uncategorized';
      spendingMap.set(categoryId, (spendingMap.get(categoryId) || 0) + txn.amount);
      countMap.set(categoryId, (countMap.get(categoryId) || 0) + 1);
    });

    const total = Array.from(spendingMap.values()).reduce((sum, amt) => sum + amt, 0);

    return Array.from(spendingMap.entries())
      .map(([categoryId, amount]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          categoryName: category?.name || 'Uncategorized',
          totalSpent: amount,
          plannedAmount: category?.plannedAmount,
          delta: category?.plannedAmount ? amount - category.plannedAmount : undefined,
          transactionCount: countMap.get(categoryId) || 0,
          percentage: total > 0 ? (amount / total) * 100 : 0,
          color: category?.color || '#9CA3AF',
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredTransactions, categories]);

  // Calculate total spending
  const totalSpending = useMemo(() => {
    return filteredTransactions.reduce((sum, txn) => sum + txn.amount, 0);
  }, [filteredTransactions]);

  // Generate AI insights
  const insights = useMemo(() => {
    return generateInsights(filteredTransactions, categories);
  }, [filteredTransactions, categories]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return categorySpending.slice(0, 8).map((cat) => ({
      name: cat.categoryName,
      value: cat.totalSpent,
      color: cat.color,
    }));
  }, [categorySpending]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">Your spending overview</p>

      {/* Period Selector */}
      <div className="flex space-x-2 mb-6 overflow-x-auto">
        {(['week', 'month', 'year', 'all'] as Period[]).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedPeriod === period
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {/* Total Spending */}
      <div className="card mb-6">
        <p className="text-sm text-gray-600 mb-1">Total Spending</p>
        <p className="text-3xl font-bold">{formatCurrency(totalSpending)}</p>
        <p className="text-sm text-gray-500 mt-1">
          {filteredTransactions.length} transaction
          {filteredTransactions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Spending Chart */}
      {chartData.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Spending by Category</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ percent }) =>
                  percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                }
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value) || 0)}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category Breakdown */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4">Category Breakdown</h2>
        <div className="space-y-3">
          {categorySpending.slice(0, 10).map((cat) => (
            <div key={cat.categoryId} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-sm">{cat.categoryName}</span>
                  <span className="text-xs text-gray-500">
                    ({cat.transactionCount})
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(cat.totalSpent)}</p>
                  {cat.plannedAmount && (
                    <div className="flex items-center space-x-1 text-xs">
                      {cat.delta && cat.delta > 0 ? (
                        <>
                          <TrendingUp size={12} className="text-red-500" />
                          <span className="text-red-600">
                            +{formatCurrency(cat.delta)}
                          </span>
                        </>
                      ) : cat.delta && cat.delta < 0 ? (
                        <>
                          <TrendingDown size={12} className="text-green-500" />
                          <span className="text-green-600">
                            {formatCurrency(cat.delta)}
                          </span>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center space-x-2 mb-3">
            <Lightbulb className="text-blue-600" size={20} />
            <h2 className="font-semibold">Insights</h2>
          </div>
          <ul className="space-y-2">
            {insights.map((insight, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start">
                <span className="mr-2">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty State */}
      {filteredTransactions.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500">No transactions for this period</p>
          <p className="text-sm text-gray-400 mt-2">
            Try selecting a different time range or import transactions
          </p>
        </div>
      )}
    </div>
  );
}
