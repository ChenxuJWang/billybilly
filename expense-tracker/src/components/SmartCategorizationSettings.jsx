import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { CATEGORIZATION_ENGINE_OPTIONS } from '@/features/categorization/constants';
import { buildLlmSystemPrompt } from '@/features/categorization/prompt';
import {
  loadCategorizationSettings,
  saveCategorizationSettings,
  verifyLlmApiKey,
} from '@/features/categorization/settings';

export default function SmartCategorizationSettings({
  smartCategorizationEnabled,
  setSmartCategorizationEnabled,
  debugModeEnabled,
  setDebugModeEnabled,
  thinkingModeEnabled,
  setThinkingModeEnabled,
}) {
  const { currentUser } = useAuth();
  const { currentLedger } = useLedger();

  const [categories, setCategories] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [categorizationEngine, setCategorizationEngine] = useState('rules');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyVerified, setApiKeyVerified] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [systemPromptError, setSystemPromptError] = useState('');
  const [systemPromptSaving, setSystemPromptSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    async function fetchCategories() {
      if (!currentLedger) {
        setCategories([]);
        return;
      }

      try {
        const categoriesSnapshot = await getDocs(
          collection(db, 'ledgers', currentLedger.id, 'categories')
        );

        setCategories(
          categoriesSnapshot.docs.map((categorySnapshot) => ({
            id: categorySnapshot.id,
            ...categorySnapshot.data(),
          }))
        );
      } catch (categoriesError) {
        console.error('Error fetching categories for categorization settings:', categoriesError);
      }
    }

    fetchCategories();
  }, [currentLedger]);

  useEffect(() => {
    async function fetchSettings() {
      setSettingsLoading(true);

      try {
        const settings = await loadCategorizationSettings(currentUser, categories);
        setSmartCategorizationEnabled(settings.enabled);
        setCategorizationEngine(settings.engine);
        setApiKey(settings.apiKey);
        setApiKeyVerified(Boolean(settings.apiKey));
        setSystemPrompt(settings.systemPrompt);
      } catch (settingsError) {
        console.error('Error loading categorization settings:', settingsError);
      } finally {
        setSettingsLoading(false);
      }
    }

    fetchSettings();
  }, [currentUser, categories, setSmartCategorizationEnabled]);

  useEffect(() => {
    if (!statusMessage && !apiKeyError && !systemPromptError) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setStatusMessage('');
      setApiKeyError('');
      setSystemPromptError('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [statusMessage, apiKeyError, systemPromptError]);

  async function persistSettings(nextSettings) {
    try {
      await saveCategorizationSettings(currentUser, nextSettings);
    } catch (saveError) {
      console.error('Failed to save categorization settings:', saveError);
    }
  }

  async function handleEnabledChange(nextEnabled) {
    setSmartCategorizationEnabled(nextEnabled);
    await persistSettings({ smartCategorizationEnabled: nextEnabled });
  }

  async function handleEngineChange(nextEngine) {
    setCategorizationEngine(nextEngine);
    setSystemPrompt((previousPrompt) =>
      previousPrompt || buildLlmSystemPrompt(categories)
    );
    await persistSettings({ categorizationEngine: nextEngine });
    setStatusMessage(`Switched automatic categorization to ${nextEngine === 'rules' ? 'Rule Engine' : 'LLM'}.`);
  }

  async function handleApiKeyVerify() {
    if (!apiKey.trim()) {
      setApiKeyError('Please enter an API key.');
      return;
    }

    setApiKeyLoading(true);
    setApiKeyError('');

    try {
      await verifyLlmApiKey(apiKey);
      setApiKeyVerified(true);
      await persistSettings({
        llmApiKey: apiKey,
        categorizationEngine: categorizationEngine,
      });
      setStatusMessage('API key verified successfully.');
    } catch (verificationError) {
      setApiKeyVerified(false);
      setApiKeyError(`API key verification failed: ${verificationError.message}`);
    } finally {
      setApiKeyLoading(false);
    }
  }

  async function handlePromptSave() {
    if (!systemPrompt.trim()) {
      setSystemPromptError('System prompt cannot be empty.');
      return;
    }

    setSystemPromptSaving(true);
    setSystemPromptError('');

    try {
      await persistSettings({ categorizationSystemPrompt: systemPrompt });
      setStatusMessage('System prompt saved.');
    } catch (promptSaveError) {
      setSystemPromptError(promptSaveError.message || 'Failed to save the system prompt.');
    } finally {
      setSystemPromptSaving(false);
    }
  }

  if (settingsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automatic Categorization</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic Categorization</CardTitle>
        <CardDescription>
          Configure which categorization engine the import flow should use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="automatic-categorization">Enable automatic categorization</Label>
          <Switch
            id="automatic-categorization"
            checked={smartCategorizationEnabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        {smartCategorizationEnabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="categorization-engine">Categorization engine</Label>
              <Select value={categorizationEngine} onValueChange={handleEngineChange}>
                <SelectTrigger id="categorization-engine">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIZATION_ENGINE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                {
                  CATEGORIZATION_ENGINE_OPTIONS.find((option) => option.value === categorizationEngine)
                    ?.description
                }
              </p>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="debug-mode">Enable debug mode (session only)</Label>
              <Switch
                id="debug-mode"
                checked={debugModeEnabled}
                onCheckedChange={setDebugModeEnabled}
              />
            </div>

            {categorizationEngine === 'llm' && (
              <>
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="thinking-mode">Enable thinking mode (session only)</Label>
                  <Switch
                    id="thinking-mode"
                    checked={thinkingModeEnabled}
                    onCheckedChange={setThinkingModeEnabled}
                  />
                </div>

                <div className="space-y-4">
                  <Label htmlFor="api-key">Doubao API Key</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="api-key"
                      type="password"
                      placeholder="Enter your Doubao API key"
                      value={apiKey}
                      onChange={(event) => {
                        setApiKey(event.target.value);
                        setApiKeyVerified(false);
                      }}
                    />
                    <Button
                      onClick={handleApiKeyVerify}
                      disabled={apiKeyLoading}
                    >
                      {apiKeyLoading ? 'Verifying...' : apiKeyVerified ? <CheckCircle className="h-4 w-4" /> : 'Verify'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="system-prompt">System Prompt</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePromptSave}
                      disabled={systemPromptSaving}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {systemPromptSaving ? 'Saving...' : 'Save Prompt'}
                    </Button>
                  </div>
                  <Textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    rows={10}
                  />
                </div>
              </>
            )}

            {categorizationEngine === 'rules' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  The rule engine is now wired into the main import flow with built-in starter rules.
                  This keeps the codebase ready for the full rule manager merge.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {apiKeyError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{apiKeyError}</AlertDescription>
          </Alert>
        )}

        {systemPromptError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemPromptError}</AlertDescription>
          </Alert>
        )}

        {statusMessage && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
