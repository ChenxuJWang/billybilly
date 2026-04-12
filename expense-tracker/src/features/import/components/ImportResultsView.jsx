import { ArrowLeft, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';

export default function ImportResultsView({ importResults, onImportMore, onBack }) {
  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Import Complete!</h1>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Transactions</span>
          </Button>
        )}
      </div>
      <Alert variant="default">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Successfully imported {importResults.imported} transactions.
          {importResults.ignored > 0 &&
            ` ${importResults.ignored} transactions were ignored by rule.`}
          {importResults.skipped > 0 &&
            ` ${importResults.skipped} transactions were skipped as duplicates or invalid rows.`}
        </AlertDescription>
      </Alert>
      <Button onClick={onImportMore}>Import More</Button>
    </div>
  );
}
