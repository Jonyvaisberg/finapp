import { useState, useRef } from 'react';
import { Upload, FileText, Image, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { parseCSVFile } from '../services/csvParser';
import { processReceiptImage } from '../services/ocrService';
import { categorizeTransactions } from '../services/categorizationService';
import { useStore } from '../store/useStore';
import { db } from '../services/database';
import { generateId } from '../utils/helpers';

export function InputScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { addTransactions, setCurrentScreen } = useStore();

  const handleCSVUpload = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      // Get existing transaction hashes for deduplication
      const existingTransactions = await db.transactions.toArray();
      const existingHashes = new Set(
        existingTransactions
          .map(t => t.duplicateCheckHash)
          .filter(Boolean) as string[]
      );

      setProgress(25);

      // Parse CSV
      const { transactions, errors, duplicates } = await parseCSVFile(file, existingHashes);

      setProgress(50);

      if (errors.length > 0) {
        setResult({
          type: 'warning',
          message: `Imported with ${errors.length} error(s). ${duplicates} duplicate(s) skipped.`,
        });
      }

      if (transactions.length === 0) {
        setResult({
          type: 'error',
          message: 'No valid transactions found in CSV file',
        });
        setIsProcessing(false);
        return;
      }

      setProgress(75);

      // Categorize transactions
      const categorized = await categorizeTransactions(
        transactions.map(t => ({
          ...t,
          id: generateId('txn'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );

      // Add to database
      await addTransactions(categorized);

      setProgress(100);

      setResult({
        type: 'success',
        message: `Successfully imported ${transactions.length} transaction(s). ${duplicates} duplicate(s) skipped.`,
      });

      // Navigate to categorization screen after 2 seconds
      setTimeout(() => {
        setCurrentScreen('categorization');
      }, 2000);
    } catch (error) {
      setResult({
        type: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      // Process receipt image
      const { transactions, errors } = await processReceiptImage(
        file,
        (progress) => setProgress(progress * 100)
      );

      if (errors.length > 0) {
        setResult({
          type: 'warning',
          message: `Processed with warnings: ${errors.join(', ')}`,
        });
      }

      if (transactions.length === 0) {
        setResult({
          type: 'error',
          message: 'Could not extract transaction from receipt',
        });
        setIsProcessing(false);
        return;
      }

      // Categorize transactions
      const categorized = await categorizeTransactions(
        transactions.map(t => ({
          ...t,
          id: generateId('txn'),
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );

      // Add to database
      await addTransactions(categorized);

      setProgress(100);

      setResult({
        type: 'success',
        message: `Successfully imported ${transactions.length} transaction(s) from receipt`,
      });

      // Navigate to categorization screen after 2 seconds
      setTimeout(() => {
        setCurrentScreen('categorization');
      }, 2000);
    } catch (error) {
      setResult({
        type: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (type: 'csv' | 'image') => {
    if (type === 'csv') {
      csvInputRef.current?.click();
    } else {
      imageInputRef.current?.click();
    }
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'csv' | 'image'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (type === 'csv') {
      handleCSVUpload(file);
    } else {
      handleImageUpload(file);
    }

    // Reset input
    event.target.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold mb-2">Import Transactions</h1>
      <p className="text-gray-600 mb-6">
        Upload bank statements or receipt images to get started
      </p>

      <div className="space-y-4">
        {/* CSV Upload */}
        <button
          onClick={() => handleFileSelect('csv')}
          disabled={isProcessing}
          className="card w-full flex items-center space-x-4 hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="bg-primary-100 p-3 rounded-lg">
            <FileText className="text-primary-600" size={32} />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-lg">Upload CSV File</h3>
            <p className="text-sm text-gray-600">
              Import transactions from your bank statement
            </p>
          </div>
          <Upload className="text-gray-400" size={24} />
        </button>

        {/* Image Upload */}
        <button
          onClick={() => handleFileSelect('image')}
          disabled={isProcessing}
          className="card w-full flex items-center space-x-4 hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="bg-purple-100 p-3 rounded-lg">
            <Image className="text-purple-600" size={32} />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-semibold text-lg">Upload Receipt Image</h3>
            <p className="text-sm text-gray-600">
              Scan a receipt using OCR technology
            </p>
          </div>
          <Upload className="text-gray-400" size={24} />
        </button>

        {/* Hidden file inputs */}
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => handleFileChange(e, 'csv')}
          className="hidden"
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e, 'image')}
          className="hidden"
        />

        {/* Processing indicator */}
        {isProcessing && (
          <div className="card">
            <div className="flex items-center space-x-3 mb-3">
              <Loader className="animate-spin text-primary-600" size={24} />
              <span className="font-medium">Processing...</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Result message */}
        {result && (
          <div
            className={`card flex items-start space-x-3 ${
              result.type === 'success'
                ? 'bg-green-50 border-green-200'
                : result.type === 'warning'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {result.type === 'success' ? (
              <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
            ) : (
              <AlertCircle
                className={
                  result.type === 'warning' ? 'text-yellow-600' : 'text-red-600'
                }
                size={24}
              />
            )}
            <p className="text-sm">{result.message}</p>
          </div>
        )}

        {/* Help text */}
        <div className="card bg-blue-50 border-blue-200">
          <h4 className="font-semibold mb-2">Supported Formats</h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• CSV files from most major banks</li>
            <li>• Receipt images (JPG, PNG)</li>
            <li>• Automatic duplicate detection</li>
            <li>• AI-powered categorization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
