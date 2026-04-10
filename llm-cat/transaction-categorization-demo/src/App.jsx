import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Download,
  FileSpreadsheet,
  Upload,
  PencilLine,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  createEmptyCategoryMapping,
  DEFAULT_BILL_CONFIGS,
  DEFAULT_CATEGORIES,
  DEFAULT_RULES,
  FIELD_OPTIONS,
  INTERNAL_TRANSACTION_TYPE_OPTIONS,
  MATCHER_OPTIONS,
  REQUIRED_FIELDS,
  RULE_LOGIC_OPTIONS,
  applyRulesToTransactions,
  createEmptyBillConfig,
  createEmptyRuleDraft,
  createRuleDraftFromTransaction,
  describeCondition,
  hydrateBillConfig,
  hydrateRule,
  parseBillText,
  readBillFileText,
} from '@/lib/billRuleEngine.js';
import './App.css';

const CONFIG_STORAGE_KEY = 'bill-rule-prototype.configs.v1';
const RULE_STORAGE_KEY = 'bill-rule-prototype.rules.v1';
const CATEGORY_STORAGE_KEY = 'bill-rule-prototype.categories.v1';
const SELECTED_CONFIG_STORAGE_KEY = 'bill-rule-prototype.selected-config.v1';

const readStorage = (key, fallbackValue) => {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

const writeStorage = (key, value) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const formatAmount = (amount, rawAmount) => {
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return `¥${amount.toFixed(2)}`;
  }

  return rawAmount || '-';
};

const getPreviewLines = (rawText, headerLineNumber) => {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
  const start = Math.max(0, Number(headerLineNumber || 1) - 4);
  const end = Math.min(lines.length, Number(headerLineNumber || 1) + 2);

  return lines.slice(start, end).map((line, index) => ({
    lineNumber: start + index + 1,
    content: line,
    isHeader: start + index + 1 === Number(headerLineNumber || 1),
  }));
};

const scopeLabel = (scope, billConfigs) => {
  if (scope === 'all') {
    return 'All bill types';
  }

  return billConfigs.find((config) => config.id === scope)?.name || scope;
};

const MATCHER_EXAMPLES = {
  contains: {
    title: 'Contains',
    description: 'Matches when the selected field includes one phrase.',
    example: 'Pattern: `先骑后付` matches `美团先骑后付`.',
  },
  containsAll: {
    title: 'Keyword AND',
    description: 'Split by comma, `|`, or new line. Every normal keyword must appear. Keywords starting with `!` must not appear.',
    example: 'Pattern: `美团,曹操惠选,!外卖` matches `美团订单-曹操惠选`, but not `美团外卖-曹操惠选`.',
  },
  containsAny: {
    title: 'Keyword OR',
    description: 'Split by comma, `|`, or new line. Any one keyword can match.',
    example: 'Pattern: `曹操惠选,享道经济型,T3特惠` matches any of those ride-hailing labels.',
  },
  exact: {
    title: 'Exact Match',
    description: 'The whole field must equal the pattern after trimming.',
    example: 'Pattern: `先骑后付` matches `先骑后付`, but not `美团先骑后付`.',
  },
  wildcard: {
    title: 'Wildcard',
    description: '`*` means any number of characters and `?` means a single character.',
    example: 'Pattern: `美团订单-*` matches `美团订单-曹操惠选`.',
  },
  regex: {
    title: 'Regex',
    description: 'Use a regular expression when the simpler matchers are not enough.',
    example: 'Pattern: `美团订单-(曹操惠选|享道经济型|T3特惠)` matches any of those labels.',
  },
};

const formatMatchedRuleReason = (details = []) => {
  if (!details.length) {
    return '';
  }

  const uniqueDetails = Array.from(
    new Set(details.map((detail) => detail.detail || detail.pattern).filter(Boolean))
  );

  return uniqueDetails.join(', ');
};

const getTransactionTypeTone = (type) => {
  if (type === 'Income') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (type === 'Expense') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-slate-300 bg-slate-100 text-slate-600';
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const quoteYamlKey = (key) => {
  const normalizedKey = String(key);
  return /^[A-Za-z0-9_-]+$/.test(normalizedKey)
    ? normalizedKey
    : `'${normalizedKey.replace(/'/g, "''")}'`;
};

const formatYamlScalar = (value) => {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : `'${String(value)}'`;
  }

  const stringValue = String(value ?? '');
  return stringValue === '' ? "''" : `'${stringValue.replace(/'/g, "''")}'`;
};

const indentYamlBlock = (text, indent) =>
  String(text)
    .split('\n')
    .map((line) => `${' '.repeat(indent)}${line}`)
    .join('\n');

const toYaml = (value, indent = 0) => {
  const prefix = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${prefix}[]`;
    }

    return value
      .map((item) => {
        if (Array.isArray(item) || isPlainObject(item)) {
          const isEmptyCollection =
            (Array.isArray(item) && item.length === 0) ||
            (isPlainObject(item) && Object.keys(item).length === 0);

          if (isEmptyCollection) {
            return `${prefix}- ${Array.isArray(item) ? '[]' : '{}'}`;
          }

          return `${prefix}-\n${toYaml(item, indent + 2)}`;
        }

        if (typeof item === 'string' && item.includes('\n')) {
          return `${prefix}- |\n${indentYamlBlock(item, indent + 2)}`;
        }

        return `${prefix}- ${formatYamlScalar(item)}`;
      })
      .join('\n');
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return `${prefix}{}`;
    }

    return entries
      .map(([key, entryValue]) => {
        const yamlKey = quoteYamlKey(key);

        if (Array.isArray(entryValue)) {
          if (entryValue.length === 0) {
            return `${prefix}${yamlKey}: []`;
          }

          return `${prefix}${yamlKey}:\n${toYaml(entryValue, indent + 2)}`;
        }

        if (isPlainObject(entryValue)) {
          if (Object.keys(entryValue).length === 0) {
            return `${prefix}${yamlKey}: {}`;
          }

          return `${prefix}${yamlKey}:\n${toYaml(entryValue, indent + 2)}`;
        }

        if (typeof entryValue === 'string' && entryValue.includes('\n')) {
          return `${prefix}${yamlKey}: |\n${indentYamlBlock(entryValue, indent + 2)}`;
        }

        return `${prefix}${yamlKey}: ${formatYamlScalar(entryValue)}`;
      })
      .join('\n');
  }

  return `${prefix}${formatYamlScalar(value)}`;
};

const getStoredBillConfigs = () =>
  (readStorage(CONFIG_STORAGE_KEY, DEFAULT_BILL_CONFIGS) || DEFAULT_BILL_CONFIGS).map(hydrateBillConfig);

const getStoredRules = () => (readStorage(RULE_STORAGE_KEY, DEFAULT_RULES) || DEFAULT_RULES).map(hydrateRule);

function StatCard({ title, value, tone = 'default' }) {
  const toneClasses = {
    default: 'border-slate-200 bg-white',
    success: 'border-emerald-200 bg-emerald-50',
    warn: 'border-amber-200 bg-amber-50',
  };

  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone] || toneClasses.default}`}>
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

const getPrunedManualCategories = (manualCategoryMap, autoReviewedTransactions) => {
  const nextManualCategories = { ...manualCategoryMap };
  let changed = false;

  for (const transaction of autoReviewedTransactions) {
    const manualCategory = nextManualCategories[transaction.id];
    if (manualCategory && manualCategory === transaction.autoCategory) {
      delete nextManualCategories[transaction.id];
      changed = true;
    }
  }

  return changed ? nextManualCategories : manualCategoryMap;
};

function App() {
  const yamlImportInputRef = useRef(null);
  const [billConfigs, setBillConfigs] = useState(() => getStoredBillConfigs());
  const [selectedConfigId, setSelectedConfigId] = useState(() =>
    readStorage(SELECTED_CONFIG_STORAGE_KEY, DEFAULT_BILL_CONFIGS[0].id)
  );
  const [categoryOptions, setCategoryOptions] = useState(() =>
    readStorage(CATEGORY_STORAGE_KEY, DEFAULT_CATEGORIES)
  );
  const [rules, setRules] = useState(() => getStoredRules());
  const [uploadedFile, setUploadedFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [parseSummary, setParseSummary] = useState({ transactions: 0, missingMappings: [] });
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [manualCategories, setManualCategories] = useState({});
  const [reviewedTransactions, setReviewedTransactions] = useState([]);
  const [ruleHits, setRuleHits] = useState({});
  const [ruleDraft, setRuleDraft] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  const selectedConfig =
    billConfigs.find((config) => config.id === selectedConfigId) || billConfigs[0] || DEFAULT_BILL_CONFIGS[0];

  const detectedBillCategories = Array.from(
    new Set(parsedTransactions.map((transaction) => transaction.transactionCategory).filter(Boolean))
  );
  const mappedSourceCategories = new Set(
    (selectedConfig?.categoryMappings || []).map((mapping) => mapping.source).filter(Boolean)
  );
  const unmappedBillCategories = detectedBillCategories.filter((category) => !mappedSourceCategories.has(category));
  const detectedTransactionTypes = Array.from(
    new Set(parsedTransactions.map((transaction) => transaction.transactionType).filter(Boolean))
  );
  const neutralTransactionTypes = detectedTransactionTypes.filter(
    (type) =>
      type !== selectedConfig?.transactionTypeMappings?.income &&
      type !== selectedConfig?.transactionTypeMappings?.expense
  );

  useEffect(() => {
    writeStorage(CONFIG_STORAGE_KEY, billConfigs);
  }, [billConfigs]);

  useEffect(() => {
    writeStorage(RULE_STORAGE_KEY, rules);
  }, [rules]);

  useEffect(() => {
    writeStorage(CATEGORY_STORAGE_KEY, categoryOptions);
  }, [categoryOptions]);

  useEffect(() => {
    writeStorage(SELECTED_CONFIG_STORAGE_KEY, selectedConfigId);
  }, [selectedConfigId]);

  useEffect(() => {
    const { reviewedTransactions: nextTransactions, hitCounts } = applyRulesToTransactions(
      parsedTransactions,
      rules,
      manualCategories
    );

    setReviewedTransactions(nextTransactions);
    setRuleHits(hitCounts);
  }, [parsedTransactions, rules, manualCategories]);

  useEffect(() => {
    if (!parsedTransactions.length || !Object.keys(manualCategories).length) {
      return;
    }

    const { reviewedTransactions: autoReviewedTransactions } = applyRulesToTransactions(
      parsedTransactions,
      rules,
      {}
    );

    const prunedManualCategories = getPrunedManualCategories(manualCategories, autoReviewedTransactions);

    if (prunedManualCategories !== manualCategories) {
      setManualCategories(prunedManualCategories);
    }
  }, [parsedTransactions, rules, manualCategories]);

  useEffect(() => {
    if (!uploadedFile || !selectedConfig) {
      return;
    }

    const parseCurrentFile = async () => {
      setIsParsing(true);
      setError('');

      try {
        const text = await readBillFileText(uploadedFile, selectedConfig.encoding);
        const result = parseBillText(text, selectedConfig);

        setRawText(text);
        setParsedHeaders(result.headers);
        setParseSummary({
          transactions: result.transactions.length,
          missingMappings: result.missingMappings,
        });
        setParsedTransactions(result.transactions);
        setManualCategories({});
      } catch (parseError) {
        setError(`Failed to parse bill: ${parseError.message}`);
        setParsedHeaders([]);
        setParsedTransactions([]);
        setParseSummary({ transactions: 0, missingMappings: [] });
      } finally {
        setIsParsing(false);
      }
    };

    parseCurrentFile();
  }, [uploadedFile, billConfigs, selectedConfig]);

  const updateSelectedConfig = (patch) => {
    setBillConfigs((currentConfigs) =>
      currentConfigs.map((config) =>
        config.id === selectedConfigId ? hydrateBillConfig({ ...config, ...patch }) : config
      )
    );
  };

  const updateSelectedMapping = (fieldKey, value) => {
    setBillConfigs((currentConfigs) =>
      currentConfigs.map((config) =>
        config.id === selectedConfigId
          ? {
              ...config,
              mappings: {
                ...config.mappings,
                [fieldKey]: value,
              },
            }
          : config
      )
    );
  };

  const updateSelectedCategoryMapping = (mappingId, patch) => {
    setBillConfigs((currentConfigs) =>
      currentConfigs.map((config) =>
        config.id === selectedConfigId
          ? {
              ...config,
              categoryMappings: (config.categoryMappings || []).map((mapping) =>
                mapping.id === mappingId ? { ...mapping, ...patch } : mapping
              ),
            }
          : config
      )
    );
  };

  const updateSelectedTransactionTypeMapping = (typeKey, value) => {
    setBillConfigs((currentConfigs) =>
      currentConfigs.map((config) =>
        config.id === selectedConfigId
          ? {
              ...config,
              transactionTypeMappings: {
                ...config.transactionTypeMappings,
                [typeKey]: value,
              },
            }
          : config
      )
    );
  };

  const handleAddCategoryMapping = (source = '') => {
    setBillConfigs((currentConfigs) =>
      currentConfigs.map((config) =>
        config.id === selectedConfigId
          ? {
              ...config,
              categoryMappings: [...(config.categoryMappings || []), createEmptyCategoryMapping(source)],
            }
          : config
      )
    );
  };

  const handleRemoveCategoryMapping = (mappingId) => {
    setBillConfigs((currentConfigs) =>
      currentConfigs.map((config) =>
        config.id === selectedConfigId
          ? {
              ...config,
              categoryMappings: (config.categoryMappings || []).filter((mapping) => mapping.id !== mappingId),
            }
          : config
      )
    );
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];

    if (!nextFile) {
      return;
    }

    setUploadedFile(nextFile);
    setStatusMessage(`Loaded ${nextFile.name}.`);
    setRuleDraft(null);
  };

  const handleCreateConfig = () => {
    const nextConfig = createEmptyBillConfig('Custom bill type');
    setBillConfigs((currentConfigs) => [...currentConfigs, nextConfig]);
    setSelectedConfigId(nextConfig.id);
    setStatusMessage('Created a new empty bill config.');
  };

  const handleDuplicateConfig = () => {
    if (!selectedConfig) {
      return;
    }

    const duplicate = {
      ...selectedConfig,
      id: `copy-${Date.now()}`,
      name: `${selectedConfig.name} copy`,
      mappings: { ...selectedConfig.mappings },
      categoryMappings: (selectedConfig.categoryMappings || []).map((mapping) => ({ ...mapping })),
      transactionTypeMappings: { ...(selectedConfig.transactionTypeMappings || {}) },
    };

    setBillConfigs((currentConfigs) => [...currentConfigs, duplicate]);
    setSelectedConfigId(duplicate.id);
    setStatusMessage('Duplicated the selected bill config.');
  };

  const handleAddCategory = () => {
    const trimmedCategory = newCategory.trim();

    if (!trimmedCategory) {
      return;
    }

    if (categoryOptions.includes(trimmedCategory)) {
      setStatusMessage(`Category "${trimmedCategory}" already exists.`);
      setNewCategory('');
      return;
    }

    setCategoryOptions((currentCategories) => [...currentCategories, trimmedCategory]);
    setNewCategory('');
    setStatusMessage(`Added category "${trimmedCategory}".`);
  };

  const handleManualCategoryChange = (transaction, nextCategory) => {
    setManualCategories((currentCategories) => ({
      ...currentCategories,
      [transaction.id]: nextCategory,
    }));

    if (nextCategory !== transaction.autoCategory) {
      setRuleDraft(
        createRuleDraftFromTransaction(
          {
            ...transaction,
            finalCategory: nextCategory,
          },
          selectedConfigId,
          nextCategory
        )
      );
      setStatusMessage(`Updated row ${transaction.rowNumber} to ${nextCategory}. You can save it as a rule below.`);
    }
  };

  const handleResetCorrection = (transactionId) => {
    setManualCategories((currentCategories) => {
      const nextCategories = { ...currentCategories };
      delete nextCategories[transactionId];
      return nextCategories;
    });
  };

  const handleStartRuleDraft = (transaction = null) => {
    if (transaction) {
      setRuleDraft(createRuleDraftFromTransaction(transaction, selectedConfigId));
      setStatusMessage(`Drafted a rule from row ${transaction.rowNumber}.`);
      return;
    }

    setRuleDraft(createEmptyRuleDraft(selectedConfigId));
    setStatusMessage('Started a blank rule draft.');
  };

  const handleEditRule = (rule) => {
    setRuleDraft({
      ...hydrateRule(rule),
      conditions: (rule.conditions || []).map((condition) => ({ ...condition })),
      sampleFields: null,
    });
    setStatusMessage(`Editing rule "${rule.name}".`);
  };

  const updateRuleDraft = (patch) => {
    setRuleDraft((currentDraft) => ({
      ...currentDraft,
      ...patch,
    }));
  };

  const handleChangeRuleDraftAutofillField = (fieldKey) => {
    setRuleDraft((currentDraft) => {
      if (!currentDraft?.sampleFields) {
        return currentDraft;
      }

      const nextConditions = [...(currentDraft.conditions || [])];

      if (nextConditions.length === 0) {
        nextConditions.push({
          id: `cond-${Date.now()}`,
          field: fieldKey,
          matcher: 'contains',
          pattern: currentDraft.sampleFields[fieldKey] || '',
        });
      } else {
        nextConditions[0] = {
          ...nextConditions[0],
          field: fieldKey,
          pattern: currentDraft.sampleFields[fieldKey] || '',
        };
      }

      return {
        ...currentDraft,
        autofillField: fieldKey,
        conditions: nextConditions,
      };
    });
  };

  const updateRuleCondition = (conditionId, patch) => {
    setRuleDraft((currentDraft) => ({
      ...currentDraft,
      conditions: currentDraft.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, ...patch } : condition
      ),
    }));
  };

  const handleAddCondition = () => {
    setRuleDraft((currentDraft) => ({
      ...currentDraft,
      conditions: [
        ...(currentDraft.conditions || []),
        {
          id: `cond-${Date.now()}`,
          field: 'description',
          matcher: 'contains',
          pattern: '',
        },
      ],
    }));
  };

  const handleAddConditionFromSample = (fieldKey) => {
    if (!ruleDraft?.sampleFields?.[fieldKey]) {
      return;
    }

    setRuleDraft((currentDraft) => ({
      ...currentDraft,
      conditions: [
        ...(currentDraft.conditions || []),
        {
          id: `cond-${Date.now()}`,
          field: fieldKey,
          matcher: 'contains',
          pattern: currentDraft.sampleFields[fieldKey],
        },
      ],
    }));
  };

  const handleRemoveCondition = (conditionId) => {
    setRuleDraft((currentDraft) => ({
      ...currentDraft,
      conditions: currentDraft.conditions.filter((condition) => condition.id !== conditionId),
    }));
  };

  const handleSaveRule = () => {
    const validConditions = (ruleDraft?.conditions || []).filter(
      (condition) => condition.field && condition.matcher && condition.pattern.trim()
    );

    if (!ruleDraft?.name.trim()) {
      setError('Rule name is required.');
      return;
    }

    if (!ruleDraft?.category) {
      setError('Rule category is required.');
      return;
    }

    if (!ruleDraft?.transactionType) {
      setError('Rule type is required.');
      return;
    }

    if (validConditions.length === 0) {
      setError('Add at least one condition before saving the rule.');
      return;
    }

    const ruleToSave = {
      ...ruleDraft,
      id: ruleDraft.id || `rule-${Date.now()}`,
      conditions: validConditions,
    };

    setRules((currentRules) => {
      const alreadyExists = currentRules.some((rule) => rule.id === ruleToSave.id);
      if (alreadyExists) {
        return currentRules.map((rule) => (rule.id === ruleToSave.id ? ruleToSave : rule));
      }

      return [ruleToSave, ...currentRules];
    });

    setRuleDraft(null);
    setError('');
    setStatusMessage(`Saved rule "${ruleToSave.name}" and re-categorized loaded transactions.`);
  };

  const handleDeleteRule = (ruleId) => {
    setRules((currentRules) => currentRules.filter((rule) => rule.id !== ruleId));
    setStatusMessage('Deleted rule and re-categorized loaded transactions.');
  };

  const handleToggleRule = (ruleId) => {
    setRules((currentRules) =>
      currentRules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
    );
    setStatusMessage('Updated rule status and re-categorized loaded transactions.');
  };

  const handleExportYamlBackup = () => {
    try {
      const backupPayload = {
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        app: 'transaction-rule-engine-prototype',
        selectedConfigId,
        categories: categoryOptions,
        billConfigs,
        rules,
      };

      const yamlText = `---\n${toYaml(backupPayload)}\n`;
      const fileName = `bill-rule-backup-${new Date().toISOString().slice(0, 10)}.yaml`;
      const blob = new Blob([yamlText], { type: 'application/yaml;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setStatusMessage(
        `Exported YAML backup with ${billConfigs.length} bill configs, ${categoryOptions.length} categories, and ${rules.length} rules.`
      );
    } catch (backupError) {
      setError(`Failed to export YAML backup: ${backupError.message}`);
    }
  };

  const handleOpenYamlImport = () => {
    yamlImportInputRef.current?.click();
  };

  const handleLoadYamlBackup = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const yamlText = await file.text();
      const yamlModule = await import('js-yaml');
      const parsed = yamlModule.load(yamlText);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('The YAML file is empty or invalid.');
      }

      const nextBillConfigs = Array.isArray(parsed.billConfigs)
        ? parsed.billConfigs.map(hydrateBillConfig)
        : [];
      const nextRules = Array.isArray(parsed.rules) ? parsed.rules.map(hydrateRule) : [];
      const nextCategories = Array.isArray(parsed.categories)
        ? parsed.categories.map((category) => String(category))
        : [];

      if (nextBillConfigs.length === 0) {
        throw new Error('The YAML backup does not contain any bill configs.');
      }

      if (nextCategories.length === 0) {
        throw new Error('The YAML backup does not contain any categories.');
      }

      const nextSelectedConfigId =
        nextBillConfigs.find((config) => config.id === parsed.selectedConfigId)?.id || nextBillConfigs[0].id;

      setBillConfigs(nextBillConfigs);
      setRules(nextRules);
      setCategoryOptions(nextCategories);
      setSelectedConfigId(nextSelectedConfigId);
      setRuleDraft(null);
      setError('');
      setStatusMessage(
        `Loaded YAML backup with ${nextBillConfigs.length} bill configs, ${nextCategories.length} categories, and ${nextRules.length} rules.`
      );
    } catch (loadError) {
      setError(`Failed to load YAML backup: ${loadError.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const matchedCount = reviewedTransactions.filter((transaction) => transaction.matchedRuleId).length;
  const correctedCount = reviewedTransactions.filter((transaction) => transaction.isCorrected).length;
  const uncategorizedCount = reviewedTransactions.filter(
    (transaction) => transaction.finalCategory === 'Uncategorized'
  ).length;
  const previewLines = getPreviewLines(rawText, selectedConfig?.headerLineNumber || 1);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_100%)]">
      <div className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${ruleDraft ? 'pb-96' : ''}`}>
        <input
          ref={yamlImportInputRef}
          type="file"
          accept=".yaml,.yml,text/yaml,text/x-yaml,application/x-yaml"
          className="hidden"
          onChange={handleLoadYamlBackup}
        />
        <section className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit bg-sky-100 text-sky-700 hover:bg-sky-100">Prototype</Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Transaction Rule Engine Workbench
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                Configure bill formats manually, parse real Alipay or WeChat CSVs, review the mislabels,
                and turn each correction into a reusable matching rule.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleExportYamlBackup}
                className="border-0 bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25 hover:from-sky-600 hover:via-cyan-600 hover:to-teal-600"
              >
                <Download className="mr-2 h-4 w-4" />
                Export YAML Backup
              </Button>
              <Button
                onClick={handleOpenYamlImport}
                className="border-0 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/25 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600"
              >
                <Upload className="mr-2 h-4 w-4" />
                Load YAML Config
              </Button>
            </div>
          </div>
        </section>

        <div className="mt-6 space-y-6">
          {(error || statusMessage) && (
            <Alert className={error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}>
              {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertDescription>{error || statusMessage}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-white/70 bg-white/85">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings2Icon />
                      Bill Format Configuration
                    </CardTitle>
                    <CardDescription>
                      Choose a bill type, then override encoding, header row, field mappings, and type mappings.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleDuplicateConfig}>
                      <Plus className="mr-2 h-4 w-4" />
                      Duplicate
                    </Button>
                    <Button size="sm" onClick={handleCreateConfig}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Config
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Bill type</Label>
                    <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bill type" />
                      </SelectTrigger>
                      <SelectContent>
                        {billConfigs.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Display name</Label>
                    <Input
                      value={selectedConfig?.name || ''}
                      onChange={(event) => updateSelectedConfig({ name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Encoding</Label>
                    <Select
                      value={selectedConfig?.encoding || 'utf-8'}
                      onValueChange={(value) => updateSelectedConfig({ encoding: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utf-8">UTF-8</SelectItem>
                        <SelectItem value="gb2312">GB2312</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Header line number</Label>
                    <Input
                      type="number"
                      min="1"
                      value={selectedConfig?.headerLineNumber || 1}
                      onChange={(event) =>
                        updateSelectedConfig({
                          headerLineNumber: Number.parseInt(event.target.value, 10) || 1,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {REQUIRED_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label>{field.label}</Label>
                      <Select
                        value={selectedConfig?.mappings?.[field.key] || '__unmapped__'}
                        onValueChange={(value) =>
                          updateSelectedMapping(field.key, value === '__unmapped__' ? '' : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select source column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unmapped__">Not mapped yet</SelectItem>
                          {parsedHeaders.map((header) => (
                            <SelectItem key={`${field.key}-${header}`} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Bill Category Mapping</p>
                      <p className="text-sm text-slate-600">
                        Map bill-native categories into the internal categories used by this prototype.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleAddCategoryMapping()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Mapping
                    </Button>
                  </div>

                  {unmappedBillCategories.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Detected In Current File</p>
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

                  <div className="space-y-3">
                    {(selectedConfig?.categoryMappings || []).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                        No bill category mappings yet.
                      </div>
                    )}

                    {(selectedConfig?.categoryMappings || []).map((mapping) => (
                      <div
                        key={mapping.id}
                        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1.2fr_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <Label>Bill category</Label>
                          <Input
                            value={mapping.source}
                            placeholder="e.g. 餐饮美食"
                            onChange={(event) =>
                              updateSelectedCategoryMapping(mapping.id, { source: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Internal category</Label>
                          <Select
                            value={mapping.target || '__empty__'}
                            onValueChange={(value) =>
                              updateSelectedCategoryMapping(mapping.id, {
                                target: value === '__empty__' ? '' : value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pick a category" />
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
                        </div>
                        <div className="flex items-end">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveCategoryMapping(mapping.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Transaction Type Mapping</p>
                    <p className="text-sm text-slate-600">
                      Map the raw values from the selected transaction type field to internal types.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Income value</Label>
                      <Select
                        value={selectedConfig?.transactionTypeMappings?.income || '__empty__'}
                        onValueChange={(value) =>
                          updateSelectedTransactionTypeMapping('income', value === '__empty__' ? '' : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select raw income value" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">Not mapped yet</SelectItem>
                          {detectedTransactionTypes.map((type) => (
                            <SelectItem key={`income-${type}`} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expense value</Label>
                      <Select
                        value={selectedConfig?.transactionTypeMappings?.expense || '__empty__'}
                        onValueChange={(value) =>
                          updateSelectedTransactionTypeMapping('expense', value === '__empty__' ? '' : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select raw expense value" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__empty__">Not mapped yet</SelectItem>
                          {detectedTransactionTypes.map((type) => (
                            <SelectItem key={`expense-${type}`} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Neutral Values On Screen</p>
                    <div className="flex flex-wrap gap-2">
                      {neutralTransactionTypes.length === 0 ? (
                        <Badge variant="outline">None</Badge>
                      ) : (
                        neutralTransactionTypes.map((type) => (
                          <Badge key={`neutral-${type}`} variant="outline" className="border-slate-300 text-slate-600">
                            {type}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Parsing notes</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    The parser only splits on CSV commas outside quotes, so spaces, dashes, slashes, and
                    other punctuation inside descriptions stay intact for rule matching.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/70 bg-white/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Import And Preview
                </CardTitle>
                <CardDescription>
                  Upload a sample bill and confirm the detected header row before reviewing transactions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Bill file</Label>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <RefreshCw className={`h-4 w-4 ${isParsing ? 'animate-spin' : ''}`} />
                  {uploadedFile ? `${uploadedFile.name}` : 'No bill selected yet'}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard title="Parsed rows" value={parseSummary.transactions} tone="default" />
                  <StatCard title="Matched by rules" value={matchedCount} tone="success" />
                  <StatCard title="Needs review" value={uncategorizedCount} tone="warn" />
                </div>

                {parseSummary.missingMappings.length > 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Missing mappings: {parseSummary.missingMappings.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>Header preview</Label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-xs text-slate-200">
                    {previewLines.length === 0 && <p>No file loaded yet.</p>}
                    {previewLines.map((line) => (
                      <div
                        key={line.lineNumber}
                        className={`grid grid-cols-[56px_1fr] gap-3 py-1 ${
                          line.isHeader ? 'text-emerald-300' : 'text-slate-300'
                        }`}
                      >
                        <span>{String(line.lineNumber).padStart(2, '0')}</span>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{line.content || ' '}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-white/70 bg-white/85">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <WandSparkles className="h-5 w-5" />
                    Rule Builder
                  </CardTitle>
                  <CardDescription>
                    Save reusable rules from manual corrections. Rules are applied top-down, first match wins.
                  </CardDescription>
                </div>
                <Button onClick={() => handleStartRuleDraft()}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-4">
                <StatCard title="Active rules" value={rules.filter((rule) => rule.enabled).length} />
                <StatCard title="Rule hits in current file" value={Object.keys(ruleHits).length} tone="success" />
                <StatCard title="Manual corrections" value={correctedCount} />
                <StatCard title="Custom categories" value={categoryOptions.length} />
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Input
                  placeholder="Add a custom category"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                />
                <Button variant="outline" onClick={handleAddCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Matching ideas:
                <div>Contains: good for one stable phrase like "先骑后付".</div>
                <div>Keyword AND: all listed keywords must appear in the chosen field.</div>
                <div>Keyword OR: any listed keyword can match, useful for aliases.</div>
                <div>Wildcard: use `*` and `?` for flexible shell-style patterns.</div>
                <div>Regex: keep it as the escape hatch for unusual patterns.</div>
              </div>

              <div className="space-y-3">
                {rules.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                    No rules yet. Create one from a corrected transaction or start a blank rule.
                  </div>
                )}

                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`rounded-2xl border p-4 ${
                      rule.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{rule.name}</p>
                          <Badge variant={rule.enabled ? 'default' : 'outline'}>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          <Badge variant="outline">{rule.category}</Badge>
                          <Badge variant="outline" className={getTransactionTypeTone(rule.transactionType)}>
                            {rule.transactionType}
                          </Badge>
                          <Badge variant="outline">{scopeLabel(rule.scope, billConfigs)}</Badge>
                          <Badge variant="outline">{rule.logic === 'all' ? 'AND' : 'OR'}</Badge>
                          <Badge variant="outline">{ruleHits[rule.id] || 0} hits</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(rule.conditions || []).map((condition) => (
                            <Badge key={condition.id} variant="secondary" className="whitespace-normal py-1">
                              {describeCondition(condition)}
                            </Badge>
                          ))}
                        </div>
                        {rule.notes && <p className="text-sm text-slate-500">{rule.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleToggleRule(rule.id)}>
                          {rule.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEditRule(rule)}>
                          <PencilLine className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/85">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Review Transactions
                  </CardTitle>
                  <CardDescription>
                    Correct the suggested category, then promote the correction into a reusable rule.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{reviewedTransactions.length} transactions</Badge>
                  <Badge variant="outline">{correctedCount} corrected</Badge>
                  <Badge variant="outline">{uncategorizedCount} uncategorized</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <StatCard title="Imported rows" value={reviewedTransactions.length} />
                <StatCard title="Rule suggestions" value={matchedCount} tone="success" />
                <StatCard title="Manual overrides" value={correctedCount} />
                <StatCard title="Still uncategorized" value={uncategorizedCount} tone="warn" />
              </div>

              {reviewedTransactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Upload a CSV bill to start reviewing parsed transactions.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200">
                  <Table className="w-full table-fixed">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[46%]">Description</TableHead>
                        <TableHead className="w-[12%]">Amount</TableHead>
                        <TableHead className="w-[20%]">Suggested</TableHead>
                        <TableHead className="w-[22%]">Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewedTransactions.map((transaction) => (
                        <TableRow
                          key={transaction.id}
                          className={transaction.isCorrected ? 'bg-amber-50/70' : ''}
                        >
                          <TableCell className="align-top">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="font-medium">#{transaction.rowNumber}</span>
                                <span>{transaction.transactionTime || '-'}</span>
                              </div>
                              <p className="whitespace-normal break-words text-sm leading-6 text-slate-900">
                                {transaction.description || '-'}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{transaction.transactionCategory || 'No label'}</Badge>
                                <Badge
                                  variant="outline"
                                  className={getTransactionTypeTone(transaction.internalTransactionType)}
                                >
                                  {transaction.internalTransactionType}
                                </Badge>
                                <Badge variant="outline" className="border-slate-200 text-slate-600">
                                  {transaction.transactionType || '-'}
                                </Badge>
                              </div>
                              <p className="whitespace-normal break-words text-xs text-slate-500">
                                {transaction.counterpartName || '-'}
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span>{transaction.source || '-'}</span>
                                <span>{transaction.transactionStatus || '-'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm font-medium text-slate-900">
                            {formatAmount(transaction.amount, transaction.amountRaw)}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant="outline"
                                  className="border-slate-300 bg-slate-100 text-slate-700"
                                >
                                  {transaction.billCategorySuggestion || 'No bill mapping'}
                                </Badge>
                                {transaction.ruleSuggestedCategory ? (
                                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                    {transaction.ruleSuggestedCategory}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="break-words text-xs text-slate-500">
                                Bill: {transaction.transactionCategory || 'No bill label'}
                              </p>
                              <p className="break-words text-xs text-amber-700">
                                {transaction.matchedRuleName || 'No rule hit'}
                              </p>
                              {transaction.matchedRuleDetails?.length ? (
                                <p className="break-words text-xs text-amber-700/90">
                                  Matched: {formatMatchedRuleReason(transaction.matchedRuleDetails)}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-2">
                              <select
                                value={transaction.finalCategory}
                                onChange={(event) =>
                                  handleManualCategoryChange(transaction, event.target.value)
                                }
                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none ring-0"
                              >
                                {categoryOptions.map((category) => (
                                  <option key={`${transaction.id}-${category}`} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                              {transaction.isCorrected ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-auto px-0 text-xs text-slate-500 hover:text-slate-900"
                                  onClick={() => handleResetCorrection(transaction.id)}
                                >
                                  Reset to auto suggestion
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {ruleDraft && (
        <RuleDraftPanel
          billConfigs={billConfigs}
          categoryOptions={categoryOptions}
          handleAddCondition={handleAddCondition}
          handleAddConditionFromSample={handleAddConditionFromSample}
          handleChangeRuleDraftAutofillField={handleChangeRuleDraftAutofillField}
          handleRemoveCondition={handleRemoveCondition}
          handleSaveRule={handleSaveRule}
          ruleDraft={ruleDraft}
          setRuleDraft={setRuleDraft}
          updateRuleCondition={updateRuleCondition}
          updateRuleDraft={updateRuleDraft}
        />
      )}
    </div>
  );
}

function Settings2Icon() {
  return <FileSpreadsheet className="h-5 w-5" />;
}

function RuleDraftPanel({
  billConfigs,
  categoryOptions,
  handleAddCondition,
  handleAddConditionFromSample,
  handleChangeRuleDraftAutofillField,
  handleRemoveCondition,
  handleSaveRule,
  ruleDraft,
  setRuleDraft,
  updateRuleCondition,
  updateRuleDraft,
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-4">
      <div className="pointer-events-auto w-full max-w-5xl rounded-3xl border border-sky-200 bg-white/96 p-5 shadow-[0_-12px_40px_-20px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-sky-700">
                {ruleDraft.sourceTransactionId ? 'Save This Correction As A Rule' : 'Editing rule draft'}
              </p>
              <p className="text-sm text-slate-600">
                {ruleDraft.sourceTransactionId
                  ? 'The pattern below is pre-filled from the selected transaction, so you can save after a light edit.'
                  : 'Scope it to one bill type or let it run across all imported files.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRuleDraft(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRule}>Save Rule</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label>Rule name</Label>
              <Input
                value={ruleDraft.name}
                onChange={(event) => updateRuleDraft({ name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={ruleDraft.category} onValueChange={(value) => updateRuleDraft({ category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rule type</Label>
              <Select
                value={ruleDraft.transactionType}
                onValueChange={(value) => updateRuleDraft({ transactionType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERNAL_TRANSACTION_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={ruleDraft.scope} onValueChange={(value) => updateRuleDraft({ scope: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All bill types</SelectItem>
                  {billConfigs.map((config) => (
                    <SelectItem key={config.id} value={config.id}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rule logic</Label>
              <Select value={ruleDraft.logic} onValueChange={(value) => updateRuleDraft({ logic: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_LOGIC_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={ruleDraft.notes || ''}
              onChange={(event) => updateRuleDraft({ notes: event.target.value })}
            />
          </div>

          {ruleDraft.sampleFields && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
              <p className="text-sm font-medium text-slate-900">Quick-fill from corrected row</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="space-y-2">
                  <Label>Autofill field</Label>
                  <Select
                    value={ruleDraft.autofillField || 'description'}
                    onValueChange={handleChangeRuleDraftAutofillField}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((field) =>
                        ruleDraft.sampleFields[field.value] ? (
                          <SelectItem key={`autofill-${field.value}`} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ) : null
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FIELD_OPTIONS.map((field) =>
                    ruleDraft.sampleFields[field.value] ? (
                      <Button
                        key={field.value}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddConditionFromSample(field.value)}
                      >
                        {field.label}
                      </Button>
                    ) : null
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-4">
            {ruleDraft.conditions.map((condition, index) => (
              <div
                key={condition.id}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr_2fr_auto]"
              >
                <div className="space-y-2">
                  <Label>Field {index + 1}</Label>
                  <Select
                    value={condition.field}
                    onValueChange={(value) => updateRuleCondition(condition.id, { field: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Matcher</Label>
                    <MatcherHelp matcher={condition.matcher} />
                  </div>
                  <Select
                    value={condition.matcher}
                    onValueChange={(value) => updateRuleCondition(condition.id, { matcher: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATCHER_OPTIONS.map((matcher) => (
                        <SelectItem key={matcher.value} value={matcher.value}>
                          {matcher.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pattern</Label>
                  <Textarea
                    rows={2}
                    value={condition.pattern}
                    placeholder="Use comma or new line for multiple keywords"
                    onChange={(event) => updateRuleCondition(condition.id, { pattern: event.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCondition(condition.id)}
                    disabled={ruleDraft.conditions.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Button variant="outline" onClick={handleAddCondition}>
              <Plus className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatcherHelp({ matcher }) {
  const content = MATCHER_EXAMPLES[matcher] || MATCHER_EXAMPLES.contains;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          aria-label={`Show help for ${content.title}`}
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">{content.title}</p>
          <p className="text-sm leading-6 text-slate-600">{content.description}</p>
          <p className="text-sm leading-6 text-slate-700">{content.example}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default App;
