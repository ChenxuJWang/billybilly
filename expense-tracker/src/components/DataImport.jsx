import React, { useEffect, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { getCategorizationEngine } from '@/features/categorization/engines';
import { getCategorizationEngineLabel } from '@/features/categorization/constants';
import {
  getCategorizationStatusMessage,
  loadCategorizationSettings,
} from '@/features/categorization/settings';
import {
  CATEGORIZATION_EMPTY_MESSAGE,
  CATEGORIZATION_STATUS_LABELS,
} from '@/features/import/constants';
import ImportSetupView from '@/features/import/components/ImportSetupView';
import ImportProgressView from '@/features/import/components/ImportProgressView';
import ImportReviewView from '@/features/import/components/ImportReviewView';
import ImportResultsView from '@/features/import/components/ImportResultsView';
import { useTransactionSuggestionScroll } from '@/features/import/hooks/useTransactionSuggestionScroll';
import { importTransactionsToLedger } from '@/features/import/utils/importTransactions';
import { parseImportedFile } from '@/features/import/utils/parseImportedTransactions';
import {
  applySuggestedCategoryUpdates,
  createPendingDisplayedTransactions,
  updateReviewedCategory,
} from '@/features/import/utils/reviewTransactions';

function createUnreviewedTransactions(transactions) {
  return transactions.map((transaction) => ({
    ...transaction,
    suggestedCategory: '',
    categorizationProcessing: false,
    matchedRuleId: null,
    matchedRuleName: '',
    matchedRuleDetails: [],
    billCategorySuggestion: '',
    ruleSuggestedCategory: '',
  }));
}

export default function DataImport({ debugModeEnabled, thinkingModeEnabled }) {
  const { currentUser } = useAuth();
  const { currentLedger, canEdit } = useLedger();

  const [selectedBillConfigId, setSelectedBillConfigId] = useState('');
  const [file, setFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [categorizationEnabled, setCategorizationEnabled] = useState(false);
  const [categorizationEngineId, setCategorizationEngineId] = useState('rules');
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [ruleEngineSettings, setRuleEngineSettings] = useState(null);

  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [displayedTransactions, setDisplayedTransactions] = useState([]);
  const [reviewingTransactions, setReviewingTransactions] = useState(false);
  const [categorizationProcessing, setCategorizationProcessing] = useState(false);
  const [processingTitle, setProcessingTitle] = useState('Categorizing imported transactions...');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoningContent, setStreamingReasoningContent] = useState('');
  const [streamingFinishReason, setStreamingFinishReason] = useState('');
  const [categorizationUsage, setCategorizationUsage] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  const abortControllerRef = useRef(null);
  const { getTransactionRef } = useTransactionSuggestionScroll(
    displayedTransactions,
    categorizationProcessing
  );

  const categorizationEngine = getCategorizationEngine(categorizationEngineId);
  const engineLabel = getCategorizationEngineLabel(categorizationEngineId);

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
      } catch (fetchError) {
        console.error('Error fetching categories:', fetchError);
      }
    }

    fetchCategories();
  }, [currentLedger]);

  useEffect(() => {
    async function fetchCategorizationSettings() {
      try {
        const settings = await loadCategorizationSettings(currentUser, categories);
        setCategorizationEnabled(settings.enabled);
        setCategorizationEngineId(settings.engine);
        setApiKey(settings.apiKey);
        setSystemPrompt(settings.systemPrompt);
        setRuleEngineSettings(settings.ruleEngineSettings);
        setSelectedBillConfigId(
          settings.ruleEngineSettings?.selectedBillConfigId ||
            settings.ruleEngineSettings?.billConfigs?.[0]?.id ||
            ''
        );
      } catch (settingsError) {
        console.error('Error loading categorization settings:', settingsError);
      }
    }

    fetchCategorizationSettings();
  }, [currentUser, categories]);

  useEffect(() => {
    if (!success && !error) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [success, error]);

  const debugPanelProps = {
    streamingContent,
    streamingReasoningContent,
    streamingFinishReason,
    usage: categorizationUsage,
    debugInfo,
  };
  const selectedBillConfig =
    ruleEngineSettings?.billConfigs?.find((config) => config.id === selectedBillConfigId) ||
    ruleEngineSettings?.billConfigs?.[0] ||
    null;

  async function runCategorization(transactions) {
    setStreamingContent('');
    setStreamingReasoningContent('');
    setStreamingFinishReason('');
    setCategorizationUsage(null);
    setDebugInfo(null);
    setProcessingTitle(
      CATEGORIZATION_STATUS_LABELS[categorizationEngineId] || 'Categorizing imported transactions...'
    );

    try {
      const result = await categorizationEngine.run({
        transactions,
        categories,
        rules: ruleEngineSettings?.rules,
        systemPrompt,
        apiKey,
        thinkingModeEnabled,
        signal: abortControllerRef.current?.signal,
        onStreamUpdate: (streamingData) => {
          if (typeof streamingData === 'string') {
            setStreamingContent(streamingData);
            return;
          }

          setStreamingContent(streamingData.content || '');
          setStreamingReasoningContent(streamingData.reasoningContent || '');
          setStreamingFinishReason(streamingData.finishReason || '');
          setCategorizationUsage(streamingData.usage || null);
          setProcessingTitle('LLM is reviewing transactions');
        },
        onPartialResults: (partialData) => {
          setDisplayedTransactions((previousTransactions) =>
            applySuggestedCategoryUpdates(
              previousTransactions,
              partialData.transactions || [],
              categories
            )
          );
        },
        onDebugUpdate: (nextDebugInfo) => {
          setDebugInfo(nextDebugInfo);
        },
      });

      setDisplayedTransactions(result.reviewedTransactions);
      setCategorizationUsage(result.usage || null);
      setReviewingTransactions(true);
    } catch (categorizationError) {
      if (categorizationError.name === 'AbortError') {
        setError('Categorization cancelled by user.');
        return;
      }

      console.error('Categorization error:', categorizationError);
      setDisplayedTransactions(createUnreviewedTransactions(transactions));
      setReviewingTransactions(true);
      setError(`${engineLabel} failed. Review the imported rows manually before confirming import.`);
    } finally {
      setCategorizationProcessing(false);
      setImporting(false);
    }
  }

  async function handleFileUpload(event) {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile || !selectedBillConfig) {
      return;
    }

    setFile(uploadedFile);
    setImporting(true);
    setImportProgress(0);
    setImportResults(null);
    setError('');
    setSuccess('');
    setReviewingTransactions(false);
    abortControllerRef.current = new AbortController();

    try {
      if (categorizationEnabled && categorizationEngineId === 'llm' && !apiKey) {
        throw new Error('The LLM engine is selected, but no verified API key is available.');
      }

      const nextParsedTransactions = await parseImportedFile({
        file: uploadedFile,
        billConfig: selectedBillConfig,
        categories,
      });

      if (nextParsedTransactions.length === 0) {
        throw new Error('No valid transactions were found in the uploaded file.');
      }

      setParsedTransactions(nextParsedTransactions);

      if (categorizationEnabled) {
        setDisplayedTransactions(createPendingDisplayedTransactions(nextParsedTransactions));
        setCategorizationProcessing(true);
        await runCategorization(nextParsedTransactions);
        return;
      }

      const result = await importTransactionsToLedger({
        currentLedger,
        currentUser,
        canEdit,
        transactions: nextParsedTransactions,
        onProgress: setImportProgress,
      });

      setImportResults(result);
      setSuccess(`Successfully imported ${result.imported} transactions.`);
    } catch (uploadError) {
      console.error('Import error:', uploadError);
      setError(uploadError.message || 'Failed to import the selected file.');
    } finally {
      setImporting(false);
      setCategorizationProcessing(false);
      event.target.value = '';
    }
  }

  async function handleRetryCategorization() {
    if (parsedTransactions.length === 0) {
      return;
    }

    setReviewingTransactions(false);
    setImporting(true);
    setCategorizationProcessing(true);
    setError('');
    setSuccess('');
    setDisplayedTransactions(createPendingDisplayedTransactions(parsedTransactions));
    abortControllerRef.current = new AbortController();
    await runCategorization(parsedTransactions);
  }

  function handleCancelCategorization() {
    abortControllerRef.current?.abort();
    setCategorizationProcessing(false);
    setImporting(false);
  }

  async function handleConfirmImport() {
    try {
      setImporting(true);
      setReviewingTransactions(false);
      setError('');
      setSuccess('');

      const result = await importTransactionsToLedger({
        currentLedger,
        currentUser,
        canEdit,
        transactions: displayedTransactions,
        onProgress: setImportProgress,
      });

      setImportResults(result);
      setSuccess(`Successfully imported ${result.imported} categorized transactions.`);
    } catch (confirmError) {
      console.error('Error confirming import:', confirmError);
      setError(confirmError.message || 'Failed to import the reviewed transactions.');
    } finally {
      setImporting(false);
    }
  }

  function handleCancelReview() {
    setReviewingTransactions(false);
    setDisplayedTransactions([]);
    setParsedTransactions([]);
    setFile(null);
    setError('');
    setSuccess('Import cancelled.');
  }

  function handleImportMore() {
    setImportResults(null);
    setFile(null);
    setParsedTransactions([]);
    setDisplayedTransactions([]);
    setImportProgress(0);
    setError('');
    setSuccess('');
  }

  function handleCategoryChange(transactionId, nextCategoryId) {
    setDisplayedTransactions((previousTransactions) =>
      updateReviewedCategory(previousTransactions, transactionId, nextCategoryId, categories)
    );
  }

  if (!currentLedger) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select a ledger before importing transactions.
      </div>
    );
  }

  if (importing) {
    return (
      <ImportProgressView
        title={categorizationProcessing ? processingTitle : 'Importing Transactions...'}
        displayedTransactions={displayedTransactions}
        getTransactionRef={getTransactionRef}
        importProgress={importProgress}
        isCategorizing={categorizationProcessing}
        processingPlaceholder={
          CATEGORIZATION_EMPTY_MESSAGE[categorizationEngineId] || 'Processing...'
        }
        onCancel={handleCancelCategorization}
        showDebug={debugModeEnabled && categorizationEngine.supportsStreaming}
        debugPanelProps={debugPanelProps}
      />
    );
  }

  if (reviewingTransactions) {
    return (
      <ImportReviewView
        displayedTransactions={displayedTransactions}
        categories={categories}
        error={error}
        onCancel={handleCancelReview}
        onRetry={handleRetryCategorization}
        onConfirm={handleConfirmImport}
        onCategoryChange={handleCategoryChange}
        retryLabel={categorizationEngineId === 'rules' ? 'Rerun Rules' : 'Retry LLM'}
        showDebug={debugModeEnabled && categorizationEngine.supportsStreaming}
        debugPanelProps={debugPanelProps}
      />
    );
  }

  if (importResults) {
    return <ImportResultsView importResults={importResults} onImportMore={handleImportMore} />;
  }

  return (
    <ImportSetupView
      file={file}
      onFileUpload={handleFileUpload}
      error={error}
      success={success}
      billConfigs={ruleEngineSettings?.billConfigs || []}
      selectedBillConfigId={selectedBillConfigId}
      setSelectedBillConfigId={setSelectedBillConfigId}
      selectedBillConfig={selectedBillConfig}
      categorizationEnabled={categorizationEnabled}
      categorizationStatusMessage={
        categorizationEnabled
          ? getCategorizationStatusMessage(categorizationEngineId, ruleEngineSettings)
          : ''
      }
    />
  );
}
