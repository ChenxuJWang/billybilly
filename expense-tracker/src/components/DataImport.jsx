import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { getCategorizationEngine } from '@/features/categorization/engines';
import { getCategorizationEngineLabel } from '@/features/categorization/constants';
import {
  getCategorizationStatusMessage,
  loadCategorizationSettings,
  saveCategorizationSettings,
} from '@/features/categorization/settings';
import {
  CATEGORIZATION_EMPTY_MESSAGE,
  CATEGORIZATION_STATUS_LABELS,
} from '@/features/import/constants';
import ImportSetupView from '@/features/import/components/ImportSetupView';
import ImportProgressView from '@/features/import/components/ImportProgressView';
import ImportReviewView from '@/features/import/components/ImportReviewView';
import ImportResultsView from '@/features/import/components/ImportResultsView';
import ImportRuleEditorDialog from '@/features/import/components/ImportRuleEditorDialog';
import { useTransactionSuggestionScroll } from '@/features/import/hooks/useTransactionSuggestionScroll';
import { importTransactionsToLedger } from '@/features/import/utils/importTransactions';
import { parseImportedFile } from '@/features/import/utils/parseImportedTransactions';
import {
  IGNORE_CATEGORY_VALUE,
  applySuggestedCategoryUpdates,
  createPendingDisplayedTransactions,
  updateReviewedCategory,
} from '@/features/import/utils/reviewTransactions';
import {
  buildCreateRuleSuggestion,
} from '@/features/import/utils/ruleSuggestions';
import {
  createEmptyRuleDraft,
  hydrateRule,
  IGNORE_CATEGORY_NAME,
} from '@/features/categorization/ruleEngine';

function createUnreviewedTransactions(transactions) {
  return transactions.map((transaction) => ({
    ...transaction,
    suggestedCategory: '',
    categorizationProcessing: false,
    matchedRuleId: null,
    matchedRuleName: '',
    matchedRuleDetails: [],
    billCategorySuggestion: transaction.mappedBillCategory || '',
    ruleSuggestedCategory: '',
  }));
}

function getFileExtension(fileName = '') {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export default function DataImport({ debugModeEnabled, thinkingModeEnabled, onBack }) {
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

  const [displayedTransactions, setDisplayedTransactions] = useState([]);
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [reviewingTransactions, setReviewingTransactions] = useState(false);
  const [categorizationProcessing, setCategorizationProcessing] = useState(false);
  const [processingTitle, setProcessingTitle] = useState('Categorizing imported transactions...');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoningContent, setStreamingReasoningContent] = useState('');
  const [streamingFinishReason, setStreamingFinishReason] = useState('');
  const [categorizationUsage, setCategorizationUsage] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [ruleSuggestionPrompt, setRuleSuggestionPrompt] = useState(null);
  const [ruleEditorState, setRuleEditorState] = useState(null);
  const [savingRuleEditor, setSavingRuleEditor] = useState(false);
  const [ruleEditorError, setRuleEditorError] = useState('');

  const abortControllerRef = useRef(null);
  const displayedTransactionsRef = useRef([]);
  const { getTransactionRef } = useTransactionSuggestionScroll(
    displayedTransactions,
    categorizationProcessing
  );

  const categorizationEngine = getCategorizationEngine(categorizationEngineId);
  const engineLabel = getCategorizationEngineLabel(categorizationEngineId);

  function resetImportState({ keepSuccessMessage = false } = {}) {
    setSelectedBillConfigId(
      ruleEngineSettings?.selectedBillConfigId ||
        ruleEngineSettings?.billConfigs?.[0]?.id ||
        ''
    );
    setFile(null);
    setImporting(false);
    setImportProgress(0);
    setImportResults(null);
    setError('');
    setSuccess((previous) => (keepSuccessMessage ? previous : ''));
    setParsedTransactions([]);
    setDisplayedTransactions([]);
    setReviewingTransactions(false);
    setCategorizationProcessing(false);
    setProcessingTitle('Categorizing imported transactions...');
    setStreamingContent('');
    setStreamingReasoningContent('');
    setStreamingFinishReason('');
    setCategorizationUsage(null);
    setDebugInfo(null);
    setRuleSuggestionPrompt(null);
    setRuleEditorState(null);
    setSavingRuleEditor(false);
    setRuleEditorError('');
  }

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

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    displayedTransactionsRef.current = displayedTransactions;
  }, [displayedTransactions]);

  useEffect(() => {
    if (!ruleSuggestionPrompt) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setRuleSuggestionPrompt(null);
    }, 11000);

    return () => clearTimeout(timer);
  }, [ruleSuggestionPrompt]);

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

  async function runCategorization(transactions, options = {}) {
    setStreamingContent('');
    setStreamingReasoningContent('');
    setStreamingFinishReason('');
    setCategorizationUsage(null);
    setDebugInfo(null);
    setProcessingTitle(
      options.overrideTitle ||
        CATEGORIZATION_STATUS_LABELS[categorizationEngineId] ||
        'Categorizing imported transactions...'
    );

    try {
      const result = await categorizationEngine.run({
        transactions,
        categories,
        rules: options.overrideRules || ruleEngineSettings?.rules,
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
      const fallbackTransactions = createUnreviewedTransactions(transactions);
      setDisplayedTransactions(fallbackTransactions);
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

    const extension = getFileExtension(uploadedFile.name);
    const pdfPresetConfig =
      extension === 'pdf'
        ? ruleEngineSettings?.billConfigs?.find((config) => config.importPreset === 'bankOfChinaPdf')
        : null;
    const activeBillConfig = pdfPresetConfig || selectedBillConfig;

    if (pdfPresetConfig && selectedBillConfigId !== pdfPresetConfig.id) {
      setSelectedBillConfigId(pdfPresetConfig.id);
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
        billConfig: activeBillConfig,
        categories,
      });

      if (nextParsedTransactions.length === 0) {
        throw new Error('No valid transactions were found in the uploaded file.');
      }

      if (pdfPresetConfig && extension === 'pdf') {
        setSuccess(`Loaded ${uploadedFile.name} and switched to ${pdfPresetConfig.name}.`);
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
    setParsedTransactions([]);
    setDisplayedTransactions([]);
    setFile(null);
    setError('');
    setSuccess('Import cancelled.');
    setRuleSuggestionPrompt(null);
    setRuleEditorState(null);
    setRuleEditorError('');
  }

  function handleImportMore() {
    setImportResults(null);
    setFile(null);
    setParsedTransactions([]);
    setDisplayedTransactions([]);
    setImportProgress(0);
    setError('');
    setSuccess('');
    setRuleSuggestionPrompt(null);
    setRuleEditorState(null);
    setRuleEditorError('');
  }

  const handleCategoryChange = useCallback((transactionId, nextCategoryId) => {
    const currentTransaction = displayedTransactionsRef.current.find(
      (transaction) => transaction.id === transactionId
    );
    const matchedCategory =
      nextCategoryId === IGNORE_CATEGORY_VALUE
        ? { id: IGNORE_CATEGORY_VALUE, name: IGNORE_CATEGORY_NAME }
        : categories.find((category) => category.id === nextCategoryId);

    startTransition(() => {
      setDisplayedTransactions((previousTransactions) =>
        updateReviewedCategory(previousTransactions, transactionId, nextCategoryId, categories)
      );
    });

    if (!currentTransaction || nextCategoryId === 'uncategorized' || !matchedCategory) {
      setRuleSuggestionPrompt(null);
      return;
    }

    if (currentTransaction.matchedRuleId && currentTransaction.categoryId !== nextCategoryId) {
      setRuleSuggestionPrompt({
        mode: 'update',
        transactionId,
        ruleId: currentTransaction.matchedRuleId,
        ruleName: currentTransaction.matchedRuleName,
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
      });
      return;
    }

    if (currentTransaction.categoryId !== nextCategoryId || currentTransaction.categoryName === 'HTT') {
      setRuleSuggestionPrompt({
        mode: 'create',
        transactionId,
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
        billTypeName: currentTransaction.billTypeName,
      });
      return;
    }

    setRuleSuggestionPrompt(null);
    setRuleEditorState(null);
    setRuleEditorError('');
  }, [categories]);

  function updateRuleEditorDraft(patch) {
    setRuleEditorState((currentState) => (
      currentState
        ? {
            ...currentState,
            ruleDraft: hydrateRule({
              ...currentState.ruleDraft,
              ...patch,
            }),
          }
        : currentState
    ));
  }

  function addRuleEditorCondition() {
    setRuleEditorState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      return {
        ...currentState,
        ruleDraft: hydrateRule({
          ...currentState.ruleDraft,
          conditions: [
            ...(currentState.ruleDraft.conditions || []),
            {
              id: createEmptyRuleDraft().conditions[0].id,
              field: 'description',
              matcher: 'contains',
              pattern: '',
            },
          ],
        }),
      };
    });
  }

  function updateRuleEditorCondition(conditionId, patch) {
    setRuleEditorState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      return {
        ...currentState,
        ruleDraft: hydrateRule({
          ...currentState.ruleDraft,
          conditions: (currentState.ruleDraft.conditions || []).map((condition) =>
            condition.id === conditionId
              ? {
                  ...condition,
                  ...patch,
                }
              : condition
          ),
        }),
      };
    });
  }

  function removeRuleEditorCondition(conditionId) {
    setRuleEditorState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      const nextConditions = (currentState.ruleDraft.conditions || []).filter(
        (condition) => condition.id !== conditionId
      );

      return {
        ...currentState,
        ruleDraft: hydrateRule({
          ...currentState.ruleDraft,
          conditions:
            nextConditions.length > 0 ? nextConditions : currentState.ruleDraft.conditions,
        }),
      };
    });
  }

  function handleOpenRuleEditor() {
    if (!ruleSuggestionPrompt || !ruleEngineSettings) {
      return;
    }

    let ruleDraft;

    if (ruleSuggestionPrompt.mode === 'create') {
      const transaction = displayedTransactions.find(
        (candidate) => candidate.id === ruleSuggestionPrompt.transactionId
      );
      const category =
        ruleSuggestionPrompt.categoryId === IGNORE_CATEGORY_VALUE
          ? { id: IGNORE_CATEGORY_VALUE, name: IGNORE_CATEGORY_NAME }
          : categories.find((candidate) => candidate.id === ruleSuggestionPrompt.categoryId);

      if (!transaction || !category) {
        return;
      }

      ruleDraft = buildCreateRuleSuggestion({
        transaction,
        category,
        existingRules: ruleEngineSettings.rules,
      });
    } else {
      const existingRule = ruleEngineSettings.rules.find(
        (rule) => rule.id === ruleSuggestionPrompt.ruleId
      );

      if (!existingRule) {
        return;
      }

      ruleDraft = hydrateRule({
        ...existingRule,
        category: ruleSuggestionPrompt.categoryName,
      });
    }

    setRuleEditorError('');
    setRuleSuggestionPrompt(null);
    setRuleEditorState({
      ...ruleSuggestionPrompt,
      ruleDraft,
    });
  }

  async function handleSaveRuleEditor() {
    if (!currentUser || !ruleEditorState || !ruleEngineSettings) {
      return;
    }

    setSavingRuleEditor(true);
    setRuleEditorError('');

    try {
      let nextRuleEngineSettings = ruleEngineSettings;

      if (ruleEditorState.mode === 'create') {
        nextRuleEngineSettings = {
          ...ruleEngineSettings,
          rules: [...ruleEngineSettings.rules, hydrateRule(ruleEditorState.ruleDraft)],
        };
        setSuccess(`Saved new rule "${ruleEditorState.ruleDraft.name}".`);
      } else {
        nextRuleEngineSettings = {
          ...ruleEngineSettings,
          rules: ruleEngineSettings.rules.map((rule) =>
            rule.id === ruleEditorState.ruleId
              ? hydrateRule({
                  ...rule,
                  ...ruleEditorState.ruleDraft,
                })
              : rule
          ),
        };
        setSuccess(`Updated rule "${ruleEditorState.ruleDraft.name || ruleEditorState.ruleName}".`);
      }

      await saveCategorizationSettings(currentUser, {
        ruleEngineSettings: nextRuleEngineSettings,
      });
      setRuleEngineSettings(nextRuleEngineSettings);
      setRuleEditorState(null);

      if (categorizationEngineId === 'rules' && parsedTransactions.length > 0) {
        setReviewingTransactions(false);
        setImporting(true);
        setCategorizationProcessing(true);
        abortControllerRef.current = new AbortController();
        await runCategorization(parsedTransactions, {
          overrideRules: nextRuleEngineSettings.rules,
          overrideTitle: 'Re-running categorization with saved rules...',
        });
      }
    } catch (saveError) {
      console.error('Failed to save import rule editor changes:', saveError);
      setRuleEditorError(saveError.message || 'Failed to save the rule.');
    } finally {
      setSavingRuleEditor(false);
    }
  }

  function handleExitImport() {
    abortControllerRef.current?.abort();
    resetImportState();
    onBack?.();
  }

  const canExitImport = !importing || categorizationProcessing || reviewingTransactions || importResults;

  let content;

  if (!currentLedger) {
    content = (
      <div className="p-6 text-center text-gray-500">
        Please select a ledger before importing transactions.
      </div>
    );
  } else if (importing) {
    content = (
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
        onBack={canExitImport ? handleExitImport : undefined}
        showDebug={debugModeEnabled && categorizationEngine.supportsStreaming}
        debugPanelProps={debugPanelProps}
      />
    );
  } else if (reviewingTransactions) {
    content = (
      <ImportReviewView
        displayedTransactions={displayedTransactions}
        categories={categories}
        error={error}
        onCancel={handleCancelReview}
        onConfirm={handleConfirmImport}
        onCategoryChange={handleCategoryChange}
        ruleSuggestionPrompt={ruleSuggestionPrompt}
        onDismissRuleSuggestion={() => setRuleSuggestionPrompt(null)}
        onApplyRuleSuggestion={handleOpenRuleEditor}
        showDebug={debugModeEnabled && categorizationEngine.supportsStreaming}
        debugPanelProps={debugPanelProps}
      />
    );
  } else if (importResults) {
    content = (
      <ImportResultsView
        importResults={importResults}
        onImportMore={handleImportMore}
        onBack={handleExitImport}
      />
    );
  } else {
    content = (
      <ImportSetupView
        file={file}
        onFileUpload={handleFileUpload}
        error={error}
        success={success}
        onBack={onBack}
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

  return (
    <>
      {content}
      <ImportRuleEditorDialog
        open={Boolean(ruleEditorState)}
        mode={ruleEditorState?.mode || 'create'}
        ruleDraft={ruleEditorState?.ruleDraft || null}
        categories={categories}
        billConfigs={ruleEngineSettings?.billConfigs || []}
        saving={savingRuleEditor}
        error={ruleEditorError}
        onOpenChange={(open) => {
          if (!open) {
            setRuleEditorState(null);
            setRuleEditorError('');
          }
        }}
        onRuleChange={updateRuleEditorDraft}
        onAddCondition={addRuleEditorCondition}
        onConditionChange={updateRuleEditorCondition}
        onRemoveCondition={removeRuleEditorCondition}
        onSave={handleSaveRuleEditor}
      />
    </>
  );
}
