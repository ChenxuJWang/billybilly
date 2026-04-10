import { AlertCircle, CheckCircle, RotateCcw, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import CategorizationDebugPanel from '@/features/import/components/CategorizationDebugPanel';
import { isUncategorizedTransaction } from '@/features/import/utils/reviewTransactions';

export default function ImportReviewView({
  displayedTransactions,
  categories,
  error,
  onCancel,
  onRetry,
  onConfirm,
  onCategoryChange,
  retryLabel,
  showDebug,
  debugPanelProps,
}) {
  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const incomeCategories = categories.filter((category) => category.type === 'income');
  const hasUncategorizedTransactions = displayedTransactions.some(isUncategorizedTransaction);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Review Categorization</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onCancel} className="flex items-center space-x-2">
            <XCircle className="h-4 w-4" />
            <span>Cancel</span>
          </Button>
          <Button variant="outline" onClick={onRetry} className="flex items-center space-x-2">
            <RotateCcw className="h-4 w-4" />
            <span>{retryLabel}</span>
          </Button>
          <Button
            onClick={onConfirm}
            className="flex items-center space-x-2"
            disabled={hasUncategorizedTransactions}
          >
            <CheckCircle className="h-4 w-4" />
            <span>Confirm Import</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Categorized Transactions</CardTitle>
          <CardDescription>Review and adjust the suggested categories before import.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {displayedTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className={`flex flex-col items-start justify-between rounded-lg border p-3 shadow-sm md:flex-row md:items-center ${
                  isUncategorizedTransaction(transaction) ? 'bg-[#B2DAFF]' : ''
                }`}
              >
                <div className="mb-2 flex-1 md:mb-0">
                  <div className="text-lg font-medium">{transaction.description}</div>
                  <div className="text-sm text-gray-600">
                    {transaction.date.toLocaleString()} • {transaction.amount} CNY
                    {transaction.counterparty && ` • ${transaction.counterparty}`}
                  </div>
                  <Badge variant={transaction.type === 'expense' ? 'destructive' : 'default'}>
                    {transaction.type}
                  </Badge>
                  {transaction.matchedRuleName && (
                    <div className="mt-2 text-sm text-gray-500">
                      Matched rule: <span className="font-medium">{transaction.matchedRuleName}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start space-y-2 md:flex-row md:items-center md:space-x-4 md:space-y-0">
                  <div className="text-sm text-gray-700">
                    Suggestion: <span className="font-semibold">{transaction.suggestedCategory || 'HTT'}</span>
                  </div>
                  <Select
                    value={
                      transaction.categoryId &&
                      categories.find((category) => category.id === transaction.categoryId)
                        ? transaction.categoryId
                        : 'uncategorized'
                    }
                    onValueChange={(value) => onCategoryChange(transaction.id, value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
                      {transaction.type === 'expense' &&
                        expenseCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      {transaction.type === 'income' &&
                        incomeCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showDebug && <CategorizationDebugPanel {...debugPanelProps} />}
    </div>
  );
}
