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
  AlertCircle,
  CheckCircle,
  Upload,
} from 'lucide-react';

export default function ImportSetupView({
  selectedPlatform,
  setSelectedPlatform,
  file,
  onFileUpload,
  error,
  success,
  importPlatforms,
  categorizationEnabled,
  categorizationStatusMessage,
}) {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Import Transactions</h1>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {categorizationEnabled && categorizationStatusMessage && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{categorizationStatusMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Import Platform</CardTitle>
          <CardDescription>Choose the platform you want to import transactions from.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a platform" />
            </SelectTrigger>
            <SelectContent>
              {importPlatforms.map((platform) => (
                <SelectItem key={platform.id} value={platform.id}>
                  <div className="flex items-center space-x-2">
                    <platform.icon className="h-4 w-4" />
                    <span>{platform.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPlatform && (
        <Card>
          <CardHeader>
            <CardTitle>
              Upload {importPlatforms.find((platform) => platform.id === selectedPlatform)?.name} File
            </CardTitle>
            <CardDescription>Upload your exported CSV file in the original platform format.</CardDescription>
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
                accept=".csv,.txt"
              />
              {file && <Badge variant="secondary">{file.name}</Badge>}
            </div>

            <div className="text-sm text-gray-500">
              <p>
                Expected fields for{' '}
                {importPlatforms.find((platform) => platform.id === selectedPlatform)?.name}:
              </p>
              <ol className="list-decimal list-inside">
                {importPlatforms
                  .find((platform) => platform.id === selectedPlatform)
                  ?.sampleFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
