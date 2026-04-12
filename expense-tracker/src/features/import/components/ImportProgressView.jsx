import { ArrowLeft, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import CategorizationDebugPanel from '@/features/import/components/CategorizationDebugPanel';

export default function ImportProgressView({
  title,
  displayedTransactions,
  getTransactionRef,
  importProgress,
  isCategorizing,
  processingPlaceholder,
  onCancel,
  onBack,
  showDebug,
  debugPanelProps,
}) {
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} className="flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Transactions</span>
            </Button>
          )}
          {isCategorizing && (
            <Button variant="outline" onClick={onCancel} className="flex items-center space-x-2">
              <XCircle className="h-4 w-4" />
              <span>Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {displayedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Imported Transactions</CardTitle>
            <CardDescription>
              {isCategorizing ? 'Categorizing imported rows before review.' : 'Importing transactions.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {displayedTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  ref={getTransactionRef(transaction.id)}
                  className="flex items-center justify-between rounded border p-2"
                >
                  <div className="flex-1">
                    <div className="font-medium">{transaction.description}</div>
                    <div className="text-sm text-gray-500">
                      {transaction.date.toLocaleString()} • {transaction.amount} CNY
                      {transaction.counterparty && ` • ${transaction.counterparty}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={transaction.type === 'expense' ? 'destructive' : 'default'}>
                      {transaction.type}
                    </Badge>
                    {isCategorizing && (
                      <div className="mt-1 text-sm text-gray-500">
                        {transaction.suggestedCategory || processingPlaceholder}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showDebug && <CategorizationDebugPanel {...debugPanelProps} />}

      {!isCategorizing && (
        <>
          <Progress value={importProgress} className="w-full" />
          <p className="text-center text-gray-600">{importProgress}% Complete</p>
        </>
      )}
    </div>
  );
}
