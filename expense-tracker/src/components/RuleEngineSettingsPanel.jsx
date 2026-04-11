import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import {
  applyRulesToTransactions,
  createEmptyBillConfig,
  createEmptyCategoryMapping,
  createEmptyRuleDraft,
  describeCondition,
  FIELD_OPTIONS,
  getPreviewLines,
  getRuleEngineCategoryOptions,
  hydrateRuleEngineSettings,
  INTERNAL_TRANSACTION_TYPE_OPTIONS,
  MATCHER_HELP,
  MATCHER_OPTIONS,
  parseBillText,
  parseRuleEngineSettingsFromYaml,
  readBillFileText,
  REQUIRED_FIELDS,
  RULE_LOGIC_OPTIONS,
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

  const [localSettings, setLocalSettings] = useState(() => hydrateRuleEngineSettings(value));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState('');
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
    setIsEditingConfig(false);
  }, [value]);

  useEffect(() => {
    if (!statusMessage && !errorMessage && !previewError) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setStatusMessage('');
      setErrorMessage('');
      setPreviewError('');
    }, 4000);

    return () => clearTimeout(timer);
  }, [statusMessage, errorMessage, previewError]);

  const selectedConfig =
    localSettings.billConfigs.find((config) => config.id === localSettings.selectedBillConfigId) ||
    localSettings.billConfigs[0] ||
    null;
  const categoryOptions = getRuleEngineCategoryOptions(categories, localSettings.customCategories);
  const currentConfigLabel = localSettings.configFileName || selectedConfig?.name || 'None';
  const unsyncedLedgerCategories = localSettings.customCategories.filter(
    (category) => !categories.some((ledgerCategory) => ledgerCategory.name === category)
  );
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
        const rawText = await readBillFileText(previewFile, selectedConfig.encoding);
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

  function updateSettings(updater) {
    setLocalSettings((currentSettings) => {
      const nextSettings =
        typeof updater === 'function' ? updater(currentSettings) : updater;
      return hydrateRuleEngineSettings(nextSettings);
    });
    setDirty(true);
  }

  async function persistSettings(nextSettings = localSettings, successMessage = 'Rule engine settings saved.') {
    setSaving(true);
    setErrorMessage('');

    try {
      const hydratedSettings = hydrateRuleEngineSettings(nextSettings);
      await onSaveRuleEngineSettings(hydratedSettings);
      setLocalSettings(hydratedSettings);
      setDirty(false);
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
    return /income|salary|freelance|investment|business|rental|gift/i.test(categoryName)
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
    ensurePanelOpen('categories');
  }

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
    }));
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
      const yamlText = serializeRuleEngineSettingsToYaml(localSettings);
      const fileName = `rule-engine-config-${new Date().toISOString().slice(0, 10)}.yaml`;
      downloadTextFile(fileName, yamlText, 'application/yaml;charset=utf-8');
      setStatusMessage('YAML config exported.');
      ensurePanelOpen('yaml');
    } catch (exportError) {
      setErrorMessage(exportError.message || 'Failed to export the YAML config.');
    }
  }

  function handleAddCustomCategory() {
    const nextCategory = newCustomCategory.trim();

    if (!nextCategory) {
      return;
    }

    if (categoryOptions.some((category) => category.toLowerCase() === nextCategory.toLowerCase())) {
      setErrorMessage('That category name already exists.');
      return;
    }

    updateSettings((currentSettings) => ({
      ...currentSettings,
      customCategories: [...currentSettings.customCategories, nextCategory],
    }));
    setNewCustomCategory('');
    ensurePanelOpen('categories');
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

  function handleRemoveCustomCategory(categoryToRemove) {
    updateSettings((currentSettings) => ({
      ...currentSettings,
      customCategories: currentSettings.customCategories.filter(
        (category) => category !== categoryToRemove
      ),
      rules: currentSettings.rules.map((rule) =>
        rule.category === categoryToRemove
          ? {
              ...rule,
              category: categoryOptions.find((category) => category !== categoryToRemove) || 'Uncategorized',
            }
          : rule
      ),
      billConfigs: currentSettings.billConfigs.map((config) => ({
        ...config,
        categoryMappings: config.categoryMappings.map((mapping) =>
          mapping.target === categoryToRemove
            ? {
                ...mapping,
                target: '',
              }
            : mapping
        ),
      })),
    }));
  }

  function createConfigFromSample(file) {
    const nextConfig = createEmptyBillConfig(formatConfigNameFromFile(file.name));

    updateSettings((currentSettings) => ({
      ...currentSettings,
      billConfigs: [...currentSettings.billConfigs, nextConfig],
      selectedBillConfigId: nextConfig.id,
    }));
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
      categoryMappings: (selectedConfig.categoryMappings || []).map((mapping) => ({
        ...mapping,
        id: createEmptyCategoryMapping().id,
      })),
    };

    updateSettings((currentSettings) => ({
      ...currentSettings,
      billConfigs: [...currentSettings.billConfigs, duplicateConfig],
      selectedBillConfigId: duplicateConfig.id,
    }));
    setIsEditingConfig(true);
    ensurePanelOpen('configs');
  }

  function handleDeleteConfig() {
    if (!selectedConfig) {
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
    });
    setPreviewFile(null);
    setPreviewData({
      rawText: '',
      headers: [],
      missingMappings: [],
      reviewedTransactions: [],
      hitCounts: {},
    });
    setIsEditingConfig(false);
  }

  function handleAddRule() {
    const nextRule = createEmptyRuleDraft('all', categoryOptions[0] || 'Uncategorized');

    updateSettings((currentSettings) => ({
      ...currentSettings,
      rules: [...currentSettings.rules, nextRule],
    }));
    ensurePanelOpen('rules');
    setOpenRuleItems((currentItems) => [...currentItems, nextRule.id]);
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
    }));
  }

  function deleteRule(ruleId) {
    updateSettings((currentSettings) => ({
      ...currentSettings,
      rules: currentSettings.rules.filter((rule) => rule.id !== ruleId),
    }));
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
    }));
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
    }));
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
    }));
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Rule Engine Configuration</p>
            <p className="text-sm text-slate-600">
              Manage reusable bill configs, small rule adjustments, and YAML backups without leaving the main app.
            </p>
          </div>
          <Button onClick={() => persistSettings()} disabled={!dirty || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : dirty ? 'Save Rule Engine Settings' : 'Saved'}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard title="Current Config" value={currentConfigLabel} />
          <StatCard title="Bill Configs" value={localSettings.billConfigs.length} />
          <StatCard title="Custom Categories" value={localSettings.customCategories.length} />
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
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {statusMessage && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      )}

      {previewError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{previewError}</AlertDescription>
        </Alert>
      )}

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
              The exported file includes the selected config, all bill configs, custom categories, and every rule.
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
                disabled={!selectedConfig}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {isEditingConfig ? 'Done Editing' : 'Edit'}
              </Button>
              <Button variant="outline" onClick={handleDuplicateConfig} disabled={!selectedConfig}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button variant="ghost" onClick={handleDeleteConfig} disabled={!selectedConfig}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>

            {selectedConfig && (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Available configs</Label>
                    <Select
                      value={localSettings.selectedBillConfigId}
                      onValueChange={(nextConfigId) => {
                        updateSettings((currentSettings) => ({
                          ...currentSettings,
                          selectedBillConfigId: nextConfigId,
                        }));
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
                    {isEditingConfig ? (
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
                    {isEditingConfig ? (
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
                    {isEditingConfig ? (
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
                      {isEditingConfig
                        ? 'Edit the source column names stored in this config.'
                        : 'Current source column mappings stored in this config.'}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {REQUIRED_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        {isEditingConfig ? (
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
                    {isEditingConfig && (
                      <Button variant="outline" size="sm" onClick={() => handleAddCategoryMapping()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Mapping
                      </Button>
                    )}
                  </div>

                  {isEditingConfig && unmappedBillCategories.length > 0 && (
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
                          {isEditingConfig ? (
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
                          {isEditingConfig ? (
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
                        {isEditingConfig && (
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
                      {isEditingConfig ? (
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
                      {isEditingConfig ? (
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
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="categories" className="px-4">
          <AccordionTrigger className="hover:no-underline">
            <div>
              <p className="font-medium text-slate-900">Custom Categories</p>
              <p className="text-sm text-slate-500">
                Add lightweight labels for rules and YAML backups. Imports only auto-resolve categories that exist in the current ledger.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Add a custom category"
                value={newCustomCategory}
                onChange={(event) => setNewCustomCategory(event.target.value)}
              />
              <Button variant="outline" onClick={handleAddCustomCategory}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
              {unsyncedLedgerCategories.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => openMissingLedgerDialog(unsyncedLedgerCategories)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Save Missing To Ledger
                </Button>
              )}
            </div>

            {unsyncedLedgerCategories.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {unsyncedLedgerCategories.length} imported categories are not in this ledger yet, so they will not auto-resolve during import until you save them.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              {localSettings.customCategories.length === 0 && (
                <Badge variant="outline">No custom categories yet</Badge>
              )}
              {localSettings.customCategories.map((category) => (
                <div
                  key={category}
                  className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm"
                >
                  <span>{category}</span>
                  {!categories.some((ledgerCategory) => ledgerCategory.name === category) && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      Not in ledger
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomCategory(category)}
                    className="text-slate-400 hover:text-slate-900"
                    aria-label={`Remove ${category}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
                <Badge variant="outline">{Object.keys(previewData.hitCounts).length} hit in sample</Badge>
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
                <AccordionItem key={rule.id} value={rule.id} className="px-4">
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
                        <Badge variant="outline">
                          {previewData.hitCounts[rule.id] || 0} sample hits
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">
                        {(rule.conditions || []).map((condition) => describeCondition(condition)).join(' | ') || 'No conditions yet'}
                      </p>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <div className="space-y-2">
                        <Label>Rule name</Label>
                        <Input
                          value={rule.name}
                          onChange={(event) => updateRule(rule.id, { name: event.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={rule.category || '__empty__'}
                          onValueChange={(nextValue) =>
                            updateRule(rule.id, {
                              category: nextValue === '__empty__' ? '' : nextValue,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__empty__">No category yet</SelectItem>
                            {categoryOptions.map((category) => (
                              <SelectItem key={`${rule.id}-${category}`} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Transaction type</Label>
                        <Select
                          value={rule.transactionType || 'Expense'}
                          onValueChange={(nextValue) =>
                            updateRule(rule.id, { transactionType: nextValue })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INTERNAL_TRANSACTION_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={`${rule.id}-${option.value}`} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Scope</Label>
                        <Select
                          value={rule.scope || 'all'}
                          onValueChange={(nextValue) => updateRule(rule.id, { scope: nextValue })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All bill types</SelectItem>
                            {localSettings.billConfigs.map((config) => (
                              <SelectItem key={`${rule.id}-${config.id}`} value={config.id}>
                                {config.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end justify-between gap-3 rounded-md border bg-slate-50 px-3 py-2">
                        <div>
                          <Label className="text-sm">Enabled</Label>
                          <p className="text-xs text-slate-500">
                            Disable a rule without deleting it.
                          </p>
                        </div>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(nextValue) => updateRule(rule.id, { enabled: nextValue })}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Rule logic</Label>
                        <Select
                          value={rule.logic || 'all'}
                          onValueChange={(nextValue) => updateRule(rule.id, { logic: nextValue })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RULE_LOGIC_OPTIONS.map((option) => (
                              <SelectItem key={`${rule.id}-${option.value}`} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                          rows={2}
                          value={rule.notes || ''}
                          onChange={(event) => updateRule(rule.id, { notes: event.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">Conditions</p>
                          <p className="text-sm text-slate-600">
                            Pick a field, matcher, and pattern. {MATCHER_HELP.containsAll}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addRuleCondition(rule.id)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Condition
                        </Button>
                      </div>

                      {(rule.conditions || []).map((condition) => (
                        <div
                          key={condition.id}
                          className="grid gap-3 rounded-md border bg-white p-3 lg:grid-cols-[1fr_1fr_2fr_auto]"
                        >
                          <div className="space-y-2">
                            <Label>Field</Label>
                            <Select
                              value={condition.field}
                              onValueChange={(nextValue) =>
                                updateRuleCondition(rule.id, condition.id, { field: nextValue })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_OPTIONS.map((option) => (
                                  <SelectItem key={`${condition.id}-${option.value}`} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Matcher</Label>
                            <Select
                              value={condition.matcher}
                              onValueChange={(nextValue) =>
                                updateRuleCondition(rule.id, condition.id, { matcher: nextValue })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MATCHER_OPTIONS.map((option) => (
                                  <SelectItem key={`${condition.id}-${option.value}`} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">
                              {MATCHER_HELP[condition.matcher]}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label>Pattern</Label>
                            <Textarea
                              rows={2}
                              value={condition.pattern}
                              onChange={(event) =>
                                updateRuleCondition(rule.id, condition.id, {
                                  pattern: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRuleCondition(rule.id, condition.id)}
                              disabled={(rule.conditions || []).length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button variant="ghost" onClick={() => deleteRule(rule.id)}>
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
