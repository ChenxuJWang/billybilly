import { CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';

export default function ImportResultsView({ importResults, onImportMore }) {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">Import Complete!</h1>
      <Alert variant="default">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Successfully imported {importResults.imported} transactions.
          {importResults.skipped > 0 &&
            ` ${importResults.skipped} transactions were skipped as duplicates or invalid rows.`}
        </AlertDescription>
      </Alert>
      <Button onClick={onImportMore}>Import More</Button>
    </div>
  );
}
