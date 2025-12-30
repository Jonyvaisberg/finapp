import { useState, useMemo } from 'react';
import { Plus, Check, X, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { formatCurrency, formatDate } from '../utils/helpers';
import { learnFromCorrection } from '../services/categorizationService';
import { parseNLCommand, executeNLCommand } from '../services/nlCommandService';

export function CategorizationScreen() {
  const { transactions, categories, updateTransaction, addCategory, loadData } =
    useStore();

  const [selectedTxnId, setSelectedTxnId] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [nlCommand, setNlCommand] = useState('');
  const [commandResult, setCommandResult] = useState<string | null>(null);

  // Sort transactions by date (newest first)
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }, [transactions]);

  const handleCategoryChange = async (
    transactionId: string,
    newCategoryId: string,
    createRule: boolean = false
  ) => {
    await updateTransaction(transactionId, {
      categoryId: newCategoryId,
      confidence: 1,
    });

    if (createRule) {
      await learnFromCorrection(transactionId, newCategoryId, true);
    }

    setSelectedTxnId(null);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    await addCategory({
      name: newCategoryName.trim(),
      color: '#3B82F6',
      isDefault: false,
    });

    setNewCategoryName('');
    setIsCreatingCategory(false);
    await loadData();
  };

  const handleNLCommand = async () => {
    if (!nlCommand.trim()) return;

    const parsed = parseNLCommand(nlCommand);
    const result = await executeNLCommand(parsed);

    setCommandResult(result.message);
    setNlCommand('');

    if (result.success) {
      await loadData();
      setTimeout(() => setCommandResult(null), 3000);
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return '#9CA3AF';
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || '#9CA3AF';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold mb-2">Review Transactions</h1>
      <p className="text-gray-600 mb-6">
        Verify and adjust AI-suggested categories
      </p>

      {/* Natural Language Command Input */}
      <div className="card mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Sparkles className="text-primary-600" size={20} />
          <h3 className="font-semibold">AI Command</h3>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={nlCommand}
            onChange={(e) => setNlCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNLCommand()}
            placeholder="e.g., Merge Dining and Restaurants"
            className="input flex-1"
          />
          <button onClick={handleNLCommand} className="btn-primary">
            Run
          </button>
        </div>
        {commandResult && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            {commandResult}
          </div>
        )}
        <div className="mt-2 text-xs text-gray-500">
          Try: "Create category Car" or "Move all Uber to Transportation"
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {sortedTransactions.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No transactions yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Import transactions to get started
            </p>
          </div>
        ) : (
          sortedTransactions.map((txn) => (
            <div
              key={txn.id}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold">{txn.vendor}</h3>
                  <p className="text-sm text-gray-600">
                    {formatDate(new Date(txn.date))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">
                    {formatCurrency(txn.amount)}
                  </p>
                  <ConfidenceBadge confidence={txn.confidence} />
                </div>
              </div>

              {/* Category Selection */}
              {selectedTxnId === txn.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(txn.id, cat.id)}
                        className="p-2 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                        style={{
                          borderColor:
                            txn.categoryId === cat.id ? cat.color : '#E5E7EB',
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-sm font-medium">
                            {cat.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setIsCreatingCategory(true)}
                    className="w-full p-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center space-x-2"
                  >
                    <Plus size={16} />
                    <span>New Category</span>
                  </button>

                  <button
                    onClick={() => setSelectedTxnId(null)}
                    className="w-full btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedTxnId(txn.id)}
                  className="w-full p-2 rounded-lg border transition-colors hover:bg-gray-50"
                  style={{
                    borderColor: getCategoryColor(txn.categoryId),
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: getCategoryColor(txn.categoryId),
                        }}
                      />
                      <span className="text-sm font-medium">
                        {getCategoryName(txn.categoryId)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">Change</span>
                  </div>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Category Modal */}
      {isCreatingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Create New Category</h3>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
              placeholder="Category name"
              className="input mb-4"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleCreateCategory}
                className="btn-primary flex-1 flex items-center justify-center space-x-2"
              >
                <Check size={18} />
                <span>Create</span>
              </button>
              <button
                onClick={() => {
                  setIsCreatingCategory(false);
                  setNewCategoryName('');
                }}
                className="btn-secondary flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
