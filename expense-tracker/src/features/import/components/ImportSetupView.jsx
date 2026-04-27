import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import {
  ArrowLeft,
  CheckCircle,
  Upload,
} from 'lucide-react';

export default function ImportSetupView({
  file,
  onFileUpload,
  onBack,
  billConfigs,
  selectedBillConfigId,
  setSelectedBillConfigId,
  selectedBillConfig,
  categorizationEnabled,
  categorizationStatusMessage,
}) {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Import Transactions</h1>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Transactions</span>
          </Button>
        )}
      </div>

      {categorizationEnabled && categorizationStatusMessage && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{categorizationStatusMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Bill Config</CardTitle>
          <CardDescription>
            Choose the saved bill config that matches the file you want to import.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedBillConfigId} onValueChange={setSelectedBillConfigId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a bill config" />
            </SelectTrigger>
            <SelectContent>
              {billConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {billConfigs.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">
              No bill configs are available yet. Add one from the Settings page before importing.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedBillConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Upload {selectedBillConfig.name} File</CardTitle>
            <CardDescription>
              {selectedBillConfig.importPreset === 'bankOfChinaPdf'
                ? 'Upload a supported Bank of China PDF statement. The built-in preset will parse it directly.'
                : 'Upload your exported file in the format expected by this saved bill config.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label
                htmlFor="file-upload"
                className="cursor-pointer rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              >
                <Upload className="mr-2 inline-block h-4 w-4" />
                Choose File
              </Label>
              <Input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={onFileUpload}
                accept=".csv,.txt,.xlsx,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              />
              {file && <Badge variant="secondary">{file.name}</Badge>}
            </div>

            <div className="text-sm text-gray-500">
              <p>Expected mapped fields for {selectedBillConfig.name}:</p>
              <ol className="list-decimal list-inside">
                {Object.entries(selectedBillConfig.mappings || {})
                  .filter(([, sourceField]) => sourceField)
                  .map(([fieldKey, sourceField]) => (
                    <li key={fieldKey}>
                      {fieldKey}: {sourceField}
                    </li>
                  ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
