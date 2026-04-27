import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Copy,
  Download,
  PencilLine,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { useToastNotifications } from '@/hooks/useToastNotifications';
import RuleEditorFields from '@/features/categorization/components/RuleEditorFields';
import { isRuleReadyToSave } from '@/features/categorization/utils/ruleEditor';
import {
  applyRulesToTransactions,
  createEmptyBillConfig,
  createEmptyCategoryMapping,
  createEmptyRuleDraft,
  describeCondition,
  getPreviewLines,
  hydrateRuleEngineSettings,
  isLockedBillConfig,
  parseBillText,
  parseRuleEngineSettingsFromYaml,
  readBillFileText,
  REQUIRED_FIELDS,
  serializeRuleEngineSettingsToYaml,
} from '@/features/categorization/ruleEngine';

function downloadTextFile(fileName, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

function formatConfigNameFromFile(fileName) {
  const rawName = String(fileName || '').replace(/\.[^.]+$/, '').trim();
  return rawName || 'Custom bill type';
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function RuleEngineSettingsPanel({
  categories,
  value,
  onSaveRuleEngineSettings,
  onRefreshLedgerCategories,
}) {
  const { currentUser } = useAuth();
  const { currentLedger, canEdit } = useLedger();
  const yamlImportInputRef = useRef(null);
  const newConfigInputRef = useRef(null);
  const pendingScrollRuleIdRef = useRef('');

  const [localSettings, setLocalSettings] = useState(() => hydrateRuleEngineSettings(value));
  const [dirty, setDirty] = useState(false);
  const [dirtyPanels, setDirtyPanels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [openPanels, setOpenPanels] = useState([]);
  const [openRuleItems, setOpenRuleItems] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [missingLedgerCategories, setMissingLedgerCategories] = useState([]);
  const [missingLedgerDialogOpen, setMissingLedgerDialogOpen] = useState(false);
  const [savingLedgerCategories, setSavingLedgerCategories] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [previewData, setPreviewData] = useState({
    rawText: '',
    headers: [],
    missingMappings: [],
    reviewedTransactions: [],
    hitCounts: {},
  });

  useEffect(() => {
    setLocalSettings(hydrateRuleEngineSettings(value));
    setDirty(false);
    setDirtyPanels([]);
    setIsEditingConfig(false);
  }, [value]);

  useToastNotifications({
    success: statusMessage,
    error: errorMessage,
    onSuccessShown: setStatusMessage,
    onErrorShown: setErrorMessage,
  });

  useToastNotifications({
    error: previewError,
    onErrorShown: setPreviewError,
  });

  const selectedConfig =
    localSettings.billConfigs.find((config) => config.id === localSettings.selectedBillConfigId) ||
    localSettings.billConfigs[0] ||
    null;
  const selectedConfigLocked = isLockedBillConfig(selectedConfig);
  const canEditSelectedConfig = isEditingConfig && !selectedConfigLocked;
  const categoryOptions = Array.from(
    new Set(categories.map((category) => category.name).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));
  const currentConfigLabel = localSettings.configFileName || selectedConfig?.name || 'None';
  const unsyncedLedgerCategories = localSettings.customCategories.filter(
    (category) => !categories.some((ledgerCategory) => ledgerCategory.name === category)
  );
  const hasSamplePreview = Boolean(previewFile);
  const mappingOptions = Array.from(
    new Set([
      ...previewData.headers,
      ...Object.values(selectedConfig?.mappings || {}).filter(Boolean),
    ])
  );
  const previewLines = getPreviewLines(previewData.rawText, selectedConfig?.headerLineNumber || 1);
  const matchedCount = previewData.reviewedTransactions.filter(
    (transaction) => transaction.matchedRuleId
  ).length;
  const detectedBillCategories = Array.from(
    new Set(
      previewData.reviewedTransactions
        .map((transaction) => transaction.transactionCategory)
        .filter(Boolean)
    )
  );
  const mappedSourceCategories = new Set(
    (selectedConfig?.categoryMappings || []).map((mapping) => mapping.source).filter(Boolean)
  );
  const unmappedBillCategories = detectedBillCategories.filter(
    (category) => !mappedSourceCategories.has(category)
  );
  const detectedTransactionTypes = Array.from(
    new Set(
      previewData.reviewedTransactions
        .map((transaction) => transaction.transactionType)
        .filter(Boolean)
    )
  );
  const neutralTransactionTypes = detectedTransactionTypes.filter(
    (type) =>
      type !== selectedConfig?.transactionTypeMappings?.income &&
      type !== selectedConfig?.transactionTypeMappings?.expense
  );
  const transactionTypeOptions = Array.from(
    new Set([
      ...detectedTransactionTypes,
      selectedConfig?.transactionTypeMappings?.income,
      selectedConfig?.transactionTypeMappings?.expense,
    ].filter(Boolean))
  );

  useEffect(() => {
    let isActive = true;

    async function parsePreviewFile() {
      if (!previewFile || !selectedConfig) {
        return;
      }

      setPreviewLoading(true);
      setPreviewError('');

      try {
        const rawText = await readBillFileText(previewFile, selectedConfig.encoding, selectedConfig);
        const parsed = parseBillText(rawText, selectedConfig, categories);
        const reviewed = applyRulesToTransactions(
          parsed.transactions,
          localSettings.rules,
          categories
        );

        if (!isActive) {
          return;
        }

        setPreviewData({
          rawText,
          headers: parsed.headers,
          missingMappings: parsed.missingMappings,
          reviewedTransactions: reviewed.reviewedTransactions,
          hitCounts: reviewed.hitCounts,
        });
      } catch (previewLoadError) {
        if (!isActive) {
          return;
        }

        setPreviewData({
          rawText: '',
          headers: [],
          missingMappings: [],
          reviewedTransactions: [],
          hitCounts: {},
        });
        setPreviewError(previewLoadError.message || 'Failed to parse the sample bill.');
      } finally {
        if (isActive) {
          setPreviewLoading(false);
        }
      }
    }

    parsePreviewFile();

    return () => {
      isActive = false;
    };
  }, [categories, localSettings.rules, previewFile, selectedConfig]);

  useEffect(() => {
    if (!pendingScrollRuleIdRef.current) {
      return;
    }

    const ruleId = pendingScrollRuleIdRef.current;
    const frameId = window.requestAnimationFrame(() => {
      const ruleElement = document.getElementById(`rule-item-${ruleId}`);
      ruleElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      pendingScrollRuleIdRef.current = '';
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [localSettings.rules, openRuleItems]);

  function updateSettings(updater, panelId = null) {
    setLocalSettings((currentSettings) => {
      const nextSettings =
        typeof updater === 'function' ? updater(currentSettings) : updater;
      return hydrateRuleEngineSettings(nextSettings);
    });
    setDirty(true);
    if (panelId) {
      setDirtyPanels((currentPanels) =>
        currentPanels.includes(panelId) ? currentPanels : [...currentPanels, panelId]
      );
    }
  }

  async function persistSettings(nextSettings = localSettings, successMessage = 'Rule engine settings saved.') {
    setSaving(true);
    setErrorMessage('');

    try {
      const hydratedSettings = hydrateRuleEngineSettings(nextSettings);
      await onSaveRuleEngineSettings(hydratedSettings);
      setLocalSettings(hydratedSettings);
      setDirty(false);
      setDirtyPanels([]);
      setStatusMessage(successMessage);
    } catch (saveError) {
      setErrorMessage(saveError.message || 'Failed to save rule engine settings.');
    } finally {
      setSaving(false);
    }
  }

  function ensurePanelOpen(panelId) {
    setOpenPanels((currentPanels) =>
      currentPanels.includes(panelId) ? currentPanels : [...currentPanels, panelId]
    );
  }

  function inferLedgerCategoryType(categoryName) {
    return /income|salary|freelance|investment|business|rental|gift|refund/i.test(categoryName)
      ? 'income'
      : 'expense';
  }

  function openMissingLedgerDialog(categoryNames) {
    const uniqueMissingCategories = Array.from(new Set(categoryNames))
      .filter(Boolean)
      .filter((category) => !categories.some((ledgerCategory) => ledgerCategory.name === category))
      .map((category) => ({
        name: category,
        type: inferLedgerCategoryType(category),
      }));

    if (uniqueMissingCategories.length === 0) {
      return;
    }

    setMissingLedgerCategories(uniqueMissingCategories);
    setMissingLedgerDialogOpen(true);
  }

  function clearPreviewState() {
    setPreviewFile(null);
    setPreviewData({
      rawText: '',
      headers: [],
      missingMappings: [],
      reviewedTransactions: [],
      hitCounts: {},
    });
    setPreviewError('');
  }

  const invalidRuleCount = localSettings.rules.filter((rule) => !isRuleReadyToSave(rule)).length;
  const canSaveRuleChanges = dirtyPanels.includes('rules') && invalidRuleCount === 0 && !saving;

  function updateSelectedConfig(patch) {
    if (!selectedConfig) {
      return;
    }

    updateSettings((currentSettings) => ({
      ...currentSettings,
      billConfigs: currentSettings.billConfigs.map((config) =>
        config.id === currentSettings.selectedBillConfigId
          ? {
              ...config,
              ...patch,
            }
          : config
      ),
    }), 'configs');
  }

  function updateSelectedMapping(fieldKey, nextValue) {
    updateSelectedConfig({
      mappings: {
        ...(selectedConfig?.mappings || {}),
        [fieldKey]: nextValue,
      },
    });
  }

  function updateSelectedTransactionTypeMapping(typeKey, nextValue) {
    updateSelectedConfig({
      transactionTypeMappings: {
        ...(selectedConfig?.transactionTypeMappings || {}),
        [typeKey]: nextValue,
      },
    });
  }

  function updateSelectedCategoryMapping(mappingId, patch) {
    updateSelectedConfig({
      categoryMappings: (selectedConfig?.categoryMappings || []).map((mapping) =>
        mapping.id === mappingId
          ? {
              ...mapping,
              ...patch,
            }
          : mapping
      ),
    });
  }

  function handleAddCategoryMapping(source = '') {
    updateSelectedConfig({
      categoryMappings: [
        ...(selectedConfig?.categoryMappings || []),
        createEmptyCategoryMapping(source),
      ],
    });
  }

  function handleRemoveCategoryMapping(mappingId) {
    updateSelectedConfig({
      categoryMappings: (selectedConfig?.categoryMappings || []).filter(
        (mapping) => mapping.id !== mappingId
      ),
    });
  }

  async function handleYamlImport(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const yamlText = await file.text();
      const nextSettings = await parseRuleEngineSettingsFromYaml(yamlText);
      const importedSettings = {
        ...nextSettings,
        configFileName: file.name,
      };
      const importedCategoryNames = importedSettings.customCategories.length > 0
        ? importedSettings.customCategories
        : importedSettings.billConfigs
            .flatMap((config) => (config.categoryMappings || []).map((mapping) => mapping.target))
            .filter(Boolean);
      setLocalSettings(importedSettings);
      setDirty(false);
      clearPreviewState();
      await persistSettings(importedSettings, 'YAML config imported successfully.');
      openMissingLedgerDialog(importedCategoryNames);
      ensurePanelOpen('yaml');
    } catch (importError) {
      setErrorMessage(importError.message || 'Failed to import the YAML config.');
    } finally {
      event.target.value = '';
    }
  }

  function handleYamlExport() {
    try {
      const yamlText = serializeRuleEngineSettingsToYaml(localSettings, categories);
      const fileName = `rule-engine-config-${new Date().toISOString().slice(0, 10)}.yaml`;
      downloadTextFile(fileName, yamlText, 'application/yaml;charset=utf-8');
      setStatusMessage('YAML config exported.');
      ensurePanelOpen('yaml');
    } catch (exportError) {
      setErrorMessage(exportError.message || 'Failed to export the YAML config.');
    }
  }

  async function handleSaveMissingLedgerCategories() {
    if (!currentLedger || !currentUser || !canEdit()) {
      setErrorMessage('You do not have permission to add categories to this ledger.');
      return;
    }

    const categoriesToCreate = missingLedgerCategories.filter((category) => category.name.trim());

    if (categoriesToCreate.length === 0) {
      setMissingLedgerDialogOpen(false);
      return;
    }

    setSavingLedgerCategories(true);
    setErrorMessage('');

    try {
      const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');

      for (const category of categoriesToCreate) {
        await addDoc(categoriesRef, {
          name: category.name,
          emoji: '📝',
          type: category.type,
          createdAt: new Date(),
          createdBy: currentUser.uid,
        });
      }

      await onRefreshLedgerCategories?.();
      setMissingLedgerDialogOpen(false);
      setMissingLedgerCategories([]);
      setStatusMessage(`Added ${categoriesToCreate.length} categories to the current ledger.`);
    } catch (saveError) {
      setErrorMessage(saveError.message || 'Failed to add categories to the current ledger.');
    } finally {
      setSavingLedgerCategories(false);
    }
  }

  function createConfigFromSample(file) {
    const nextConfig = createEmptyBillConfig(formatConfigNameFromFile(file.name));

    updateSettings((currentSettings) => ({
      ...currentSettings,
      billConfigs: [...currentSettings.billConfigs, nextConfig],
      selectedBillConfigId: nextConfig.id,
    }), 'configs');
    setPreviewFile(file);
    setIsEditingConfig(true);
    ensurePanelOpen('configs');
    setStatusMessage('New bill config created from the uploaded sample. Review the header row before saving.');
  }

  function handleNewConfigSample(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    createConfigFromSample(file);
    event.target.value = '';
  }

  function handleDuplicateConfig() {
    if (!selectedConfig) {
      return;
    }

    const duplicateConfig = {
      ...selectedConfig,
      id: createEmptyBillConfig(`${selectedConfig.name} Copy`).id,
      name: `${selectedConfig.name} Copy`,
      locked: false,
      categoryMappings: (selectedConfig.categoryMappings || []).map((mapping) => ({
        ...mapping,
        id: createEmptyCategoryMapping().id,
      })),
    };

    updateSettings((currentSettings) => ({
      ...currentSettings,
      billConfigs: [...currentSettings.billConfigs, duplicateConfig],
      selectedBillConfigId: duplicateConfig.id,
    }), 'configs');
    clearPreviewState();
    setIsEditingConfig(true);
    ensurePanelOpen('configs');
  }

  function handleDeleteConfig() {
    if (!selectedConfig) {
      return;
    }

    if (selectedConfigLocked) {
      setErrorMessage('This built-in config is read-only and cannot be deleted.');
      return;
    }

    if (localSettings.billConfigs.length === 1) {
      setErrorMessage('At least one bill config must remain available.');
      return;
    }

    const nextConfigs = localSettings.billConfigs.filter(
      (config) => config.id !== selectedConfig.id
    );

    updateSettings({
      ...localSettings,
      billConfigs: nextConfigs,
      selectedBillConfigId: nextConfigs[0].id,
      rules: localSettings.rules.map((rule) =>
        rule.scope === selectedConfig.id
          ? {
              ...rule,
              scope: 'all',
            }
          : rule
      ),
    }, 'configs');
    clearPreviewState();
    setIsEditingConfig(false);
  }

  function handleAddRule() {
    const nextRule = createEmptyRuleDraft('all');

    updateSettings((currentSettings) => ({
      ...currentSettings,
      rules: [nextRule, ...currentSettings.rules],
    }), 'rules');
    ensurePanelOpen('rules');
    setOpenRuleItems((currentItems) =>
      currentItems.includes(nextRule.id) ? currentItems : [nextRule.id, ...currentItems]
    );
    pendingScrollRuleIdRef.current = nextRule.id;
  }

  function updateRule(ruleId, patch) {
    updateSettings((currentSettings) => ({
      ...currentSettings,
      rules: currentSettings.rules.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              ...patch,
            }
          : rule
      ),
    }), 'rules');
  }

  async function deleteRule(ruleId) {
    const nextSettings = hydrateRuleEngineSettings({
      ...localSettings,
      rules: localSettings.rules.filter((rule) => rule.id !== ruleId),
    });

    setLocalSettings(nextSettings);
    setDirty(true);
    setDirtyPanels((currentPanels) =>
      currentPanels.includes('rules') ? currentPanels : [...currentPanels, 'rules']
    );
    setOpenRuleItems((currentItems) => currentItems.filter((itemId) => itemId !== ruleId));
    await persistSettings(nextSettings, 'Rule deleted.');
  }

  function addRuleCondition(ruleId) {
    updateSettings((currentSettings) => ({
      ...currentSettings,
      rules: currentSettings.rules.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              conditions: [
                ...(rule.conditions || []),
                {
                  id: createEmptyRuleDraft().conditions[0].id,
                  field: 'description',
                  matcher: 'contains',
                  pattern: '',
                },
              ],
            }
          : rule
      ),
    }), 'rules');
    setOpenRuleItems((currentItems) =>
      currentItems.includes(ruleId) ? currentItems : [...currentItems, ruleId]
    );
  }

  function updateRuleCondition(ruleId, conditionId, patch) {
    updateSettings((currentSettings) => ({
      ...currentSettings,
      rules: currentSettings.rules.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              conditions: (rule.conditions || []).map((condition) =>
                condition.id === conditionId
                  ? {
                      ...condition,
                      ...patch,
                    }
                  : condition
              ),
            }
          : rule
      ),
    }), 'rules');
  }

  function removeRuleCondition(ruleId, conditionId) {
    updateSettings((currentSettings) => ({
      ...currentSettings,
      rules: currentSettings.rules.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }

        const nextConditions = (rule.conditions || []).filter(
          (condition) => condition.id !== conditionId
        );

        return {
          ...rule,
          conditions: nextConditions.length > 0 ? nextConditions : rule.conditions,
        };
      }),
    }), 'rules');
  }

  return (
    <div className="space-y-4">
      <input
        ref={yamlImportInputRef}
        type="file"
        accept=".yaml,.yml,text/yaml,text/x-yaml,application/x-yaml"
        className="hidden"
        onChange={handleYamlImport}
      />
      <input
        ref={newConfigInputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleNewConfigSample}
      />

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Rule Engine Configuration</p>
            <p className="text-sm text-slate-600">
              Manage reusable bill configs, small rule adjustments, and YAML backups without leaving the main app.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard title="Current Config" value={currentConfigLabel} />
          <StatCard title="Bill Configs" value={localSettings.billConfigs.length} />
          <StatCard title="Ledger Categories" value={categories.length} />
          <StatCard title="Rules" value={localSettings.rules.length} />
        </div>

        {dirty && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have unsaved rule-engine changes. Save them here before relying on the import flow.
            </AlertDescription>
          </Alert>
        )}

        {unsyncedLedgerCategories.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {unsyncedLedgerCategories.length} YAML categories are still missing from the current ledger.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMissingLedgerDialog(unsyncedLedgerCategories)}
              >
                Save Missing To Ledger
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Accordion type="multiple" value={openPanels} onValueChange={setOpenPanels} className="rounded-md border">
        <AccordionItem value="yaml" className="px-4">
          <AccordionTrigger className="hover:no-underline">
            <div>
              <p className="font-medium text-slate-900">YAML Config</p>
              <p className="text-sm text-slate-500">
                Import and export the full rule-engine configuration as YAML.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleYamlExport}>
                <Download className="mr-2 h-4 w-4" />
                Export YAML
              </Button>
              <Button variant="outline" onClick={() => yamlImportInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Import YAML
              </Button>
            </div>
            <p className="text-sm text-slate-600">
              The exported file includes the selected config, all bill configs, all ledger categories, and every rule.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="configs" className="px-4">
          <AccordionTrigger className="hover:no-underline">
            <div>
              <p className="font-medium text-slate-900">Bill Configs</p>
              <p className="text-sm text-slate-500">
                Review available bill configs, edit mappings, and add new ones from a sample file.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => newConfigInputRef.current?.click()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Config From Sample
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditingConfig((currentValue) => !currentValue)}
                disabled={!selectedConfig || selectedConfigLocked}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {isEditingConfig ? 'Done Editing' : 'Edit'}
              </Button>
              <Button variant="outline" onClick={handleDuplicateConfig} disabled={!selectedConfig}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                onClick={handleDeleteConfig}
                disabled={!selectedConfig || selectedConfigLocked}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>

            {selectedConfig && (
              <>
                {selectedConfigLocked && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This is a built-in read-only PDF preset for supported Bank of China statements.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Available configs</Label>
                    <Select
                      value={localSettings.selectedBillConfigId}
                      onValueChange={(nextConfigId) => {
                        updateSettings((currentSettings) => ({
                          ...currentSettings,
                          selectedBillConfigId: nextConfigId,
                        }), 'configs');
                        clearPreviewState();
                        setIsEditingConfig(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bill config" />
                      </SelectTrigger>
                      <SelectContent>
                        {localSettings.billConfigs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Config name</Label>
                    {canEditSelectedConfig ? (
                      <Input
                        value={selectedConfig.name || ''}
                        onChange={(event) => updateSelectedConfig({ name: event.target.value })}
                      />
                    ) : (
                      <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900">
                        {selectedConfig.name || 'Untitled config'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Encoding</Label>
                    {canEditSelectedConfig ? (
                      <Select
                        value={selectedConfig.encoding || 'utf-8'}
                        onValueChange={(nextEncoding) =>
                          updateSelectedConfig({ encoding: nextEncoding })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="utf-8">UTF-8</SelectItem>
                          <SelectItem value="gb2312">GB2312</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900">
                        {(selectedConfig.encoding || 'utf-8').toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Header row</Label>
                    {canEditSelectedConfig ? (
                      <Input
                        type="number"
                        min="1"
                        value={selectedConfig.headerLineNumber || 1}
                        onChange={(event) =>
                          updateSelectedConfig({
                            headerLineNumber: Number.parseInt(event.target.value, 10) || 1,
                          })
                        }
                      />
                    ) : (
                      <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900">
                        {selectedConfig.headerLineNumber || 1}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-slate-900">Field Mappings</p>
                    <p className="text-sm text-slate-600">
                      {canEditSelectedConfig
                        ? 'Edit the source column names stored in this config.'
                        : 'Current source column mappings stored in this config.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {REQUIRED_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        {canEditSelectedConfig ? (
                          <Select
                            value={selectedConfig.mappings?.[field.key] || '__unmapped__'}
                            onValueChange={(nextValue) =>
                              updateSelectedMapping(
                                field.key,
                                nextValue === '__unmapped__' ? '' : nextValue
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select source column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unmapped__">Not mapped yet</SelectItem>
                              {mappingOptions.map((option) => (
                                <SelectItem key={`${field.key}-${option}`} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900">
                            {selectedConfig.mappings?.[field.key] || 'Not mapped yet'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Bill Category Mappings</p>
                      <p className="text-sm text-slate-600">
                        Map bill-native categories into the categories used by this ledger and rule set.
                      </p>
                    </div>
                    {canEditSelectedConfig && (
                      <Button variant="outline" size="sm" onClick={() => handleAddCategoryMapping()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Mapping
                      </Button>
                    )}
                  </div>

                  {canEditSelectedConfig && unmappedBillCategories.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Detected In Current Sample
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {unmappedBillCategories.map((category) => (
                          <Button
                            key={category}
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddCategoryMapping(category)}
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    {(selectedConfig.categoryMappings || []).length === 0 && (
                      <div className="rounded-md border border-dashed bg-white px-3 py-4 text-sm text-slate-500">
                        No bill category mappings yet.
                      </div>
                    )}

                    {(selectedConfig.categoryMappings || []).map((mapping) => (
                      <div
                        key={mapping.id}
                        className="grid gap-3 rounded-md border bg-white p-3 lg:grid-cols-[1.2fr_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <Label>Bill category</Label>
                          {canEditSelectedConfig ? (
                            <Input
                              value={mapping.source}
                              onChange={(event) =>
                                updateSelectedCategoryMapping(mapping.id, {
                                  source: event.target.value,
                                })
                              }
                            />
                          ) : (
                            <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-900">
                              {mapping.source || 'Not set'}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Target category</Label>
                          {canEditSelectedConfig ? (
                            <Select
                              value={mapping.target || '__empty__'}
                              onValueChange={(nextValue) =>
                                updateSelectedCategoryMapping(mapping.id, {
                                  target: nextValue === '__empty__' ? '' : nextValue,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__empty__">No target yet</SelectItem>
                                {categoryOptions.map((category) => (
                                  <SelectItem key={`${mapping.id}-${category}`} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-900">
                              {mapping.target || 'Not set'}
                            </div>
                          )}
                        </div>
                        {canEditSelectedConfig && (
                          <div className="flex items-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveCategoryMapping(mapping.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Transaction Type Mapping</p>
                    <p className="text-sm text-slate-600">
                      Match the raw values from the imported file to the internal transaction types.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Income value</Label>
                      {canEditSelectedConfig ? (
                        <Select
                          value={selectedConfig.transactionTypeMappings?.income || '__empty__'}
                          onValueChange={(nextValue) =>
                            updateSelectedTransactionTypeMapping(
                              'income',
                              nextValue === '__empty__' ? '' : nextValue
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select income value" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__empty__">Not mapped yet</SelectItem>
                            {transactionTypeOptions.map((type) => (
                              <SelectItem key={`income-${type}`} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900">
                          {selectedConfig.transactionTypeMappings?.income || 'Not mapped yet'}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Expense value</Label>
                      {canEditSelectedConfig ? (
                        <Select
                          value={selectedConfig.transactionTypeMappings?.expense || '__empty__'}
                          onValueChange={(nextValue) =>
                            updateSelectedTransactionTypeMapping(
                              'expense',
                              nextValue === '__empty__' ? '' : nextValue
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select expense value" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__empty__">Not mapped yet</SelectItem>
                            {transactionTypeOptions.map((type) => (
                              <SelectItem key={`expense-${type}`} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-900">
                          {selectedConfig.transactionTypeMappings?.expense || 'Not mapped yet'}
                        </div>
                      )}
                    </div>
                  </div>

                  {previewFile && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Unmapped Type Values In Sample
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {neutralTransactionTypes.length === 0 ? (
                          <Badge variant="outline">None</Badge>
                        ) : (
                          neutralTransactionTypes.map((type) => (
                            <Badge key={`neutral-${type}`} variant="outline">
                              {type}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {previewFile && (
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">Sample Preview</p>
                        <p className="text-sm text-slate-600">
                          This preview comes from the sample used to create the current config.
                        </p>
                      </div>
                      <Badge variant="outline">
                        {previewLoading ? 'Parsing sample...' : previewFile.name}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <StatCard title="Parsed Rows" value={previewData.reviewedTransactions.length} />
                      <StatCard title="Rule Hits" value={matchedCount} />
                      <StatCard title="Missing Mappings" value={previewData.missingMappings.length} />
                    </div>

                    {previewData.missingMappings.length > 0 && (
                      <Alert className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Missing mappings: {previewData.missingMappings.join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="mt-4 space-y-2">
                      <Label>Header preview</Label>
                      <div className="rounded-md border bg-slate-950 px-4 py-3 font-mono text-xs text-slate-200">
                        {previewLines.length === 0 && <p>No sample loaded yet.</p>}
                        {previewLines.map((line) => (
                          <div
                            key={line.lineNumber}
                            className={`grid grid-cols-[56px_1fr] gap-3 py-1 ${
                              line.isHeader ? 'text-emerald-300' : 'text-slate-300'
                            }`}
                          >
                            <span>{String(line.lineNumber).padStart(2, '0')}</span>
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                              {line.content || ' '}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {dirtyPanels.includes('configs') && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => persistSettings(localSettings, 'Bill config changes saved.')}
                      disabled={saving}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Bill Config Changes'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rules" className="px-4">
          <AccordionTrigger className="hover:no-underline">
            <div>
              <p className="font-medium text-slate-900">Rule Management</p>
              <p className="text-sm text-slate-500">
                Enable, disable, edit, and add rules. Rules are applied top-down and stop on the first match.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{localSettings.rules.filter((rule) => rule.enabled).length} enabled</Badge>
                {hasSamplePreview && (
                  <Badge variant="outline">{Object.keys(previewData.hitCounts).length} hit in sample</Badge>
                )}
              </div>
              <Button onClick={handleAddRule}>
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </div>

            {localSettings.rules.length === 0 && (
              <div className="rounded-md border border-dashed px-4 py-5 text-sm text-slate-500">
                No rules yet. Add one here to refine the rule engine without using the review workflow.
              </div>
            )}

            <Accordion
              type="multiple"
              value={openRuleItems}
              onValueChange={setOpenRuleItems}
              className="rounded-md border"
            >
              {localSettings.rules.map((rule) => (
                <AccordionItem
                  key={rule.id}
                  value={rule.id}
                  className="px-4"
                  id={`rule-item-${rule.id}`}
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="space-y-2 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {rule.name || 'Untitled rule'}
                        </span>
                        <Badge variant={rule.enabled ? 'default' : 'outline'}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline">{rule.category || 'No category'}</Badge>
                        {hasSamplePreview && (
                          <Badge variant="outline">
                            {previewData.hitCounts[rule.id] || 0} sample hits
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {(rule.conditions || []).map((condition) => describeCondition(condition)).join(' | ') || 'No conditions yet'}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <RuleEditorFields
                      rule={rule}
                      categories={categories}
                      billConfigs={localSettings.billConfigs}
                      onRuleChange={(patch) => updateRule(rule.id, patch)}
                      onAddCondition={() => addRuleCondition(rule.id)}
                      onConditionChange={(conditionId, patch) =>
                        updateRuleCondition(rule.id, conditionId, patch)
                      }
                      onRemoveCondition={(conditionId) => removeRuleCondition(rule.id, conditionId)}
                    />

                    <div className="flex justify-end gap-2">
                      {dirtyPanels.includes('rules') && (
                        <Button
                          onClick={() => persistSettings(localSettings, 'Rule changes saved.')}
                          disabled={!canSaveRuleChanges}
                          title={
                            invalidRuleCount > 0
                              ? 'Complete each rule with a category and filled condition patterns before saving.'
                              : undefined
                          }
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? 'Saving...' : 'Save Rule Changes'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => deleteRule(rule.id)}
                        disabled={saving}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Rule
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {missingLedgerDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col rounded-lg border bg-white shadow-lg">
            <div className="space-y-2 border-b px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">Save Imported Categories To Ledger</h2>
              <p className="text-sm text-slate-600">
                These categories were imported from YAML but are not in the current ledger yet. Save them now so imports and reviews can resolve them directly.
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {missingLedgerCategories.map((category, index) => (
                <div
                  key={`${category.name}-${index}`}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_140px]"
                >
                  <div className="space-y-1">
                    <Label>Category name</Label>
                    <Input
                      value={category.name}
                      onChange={(event) =>
                        setMissingLedgerCategories((currentCategories) =>
                          currentCategories.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  name: event.target.value,
                                }
                              : entry
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Ledger type</Label>
                    <Select
                      value={category.type}
                      onValueChange={(nextValue) =>
                        setMissingLedgerCategories((currentCategories) =>
                          currentCategories.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  type: nextValue,
                                }
                              : entry
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setMissingLedgerDialogOpen(false);
                  setMissingLedgerCategories([]);
                }}
              >
                Not Now
              </Button>
              <Button onClick={handleSaveMissingLedgerCategories} disabled={savingLedgerCategories}>
                {savingLedgerCategories ? 'Saving...' : 'Save To Ledger'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
