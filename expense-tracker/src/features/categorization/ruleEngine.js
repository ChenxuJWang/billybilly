import {
  resolveCategoryForTransaction,
  resolveDisplayedTransactionType,
} from '@/features/categorization/utils/categoryResolution';

const createId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
export const IGNORE_CATEGORY_NAME = 'IGNORE';

export const INTERNAL_TRANSACTION_TYPES = ['Income', 'Expense', 'Neutral'];

export const INTERNAL_TRANSACTION_TYPE_OPTIONS = INTERNAL_TRANSACTION_TYPES.map((type) => ({
  value: type,
  label: type,
}));

export const REQUIRED_FIELDS = [
  { key: 'transactionTime', label: 'Transaction time' },
  { key: 'transactionCategory', label: 'Transaction category' },
  { key: 'transactionType', label: 'Transaction type' },
  { key: 'counterpartName', label: 'Counterpart name' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount' },
  { key: 'source', label: 'Source' },
  { key: 'transactionStatus', label: 'Transaction status' },
];

export const FIELD_OPTIONS = REQUIRED_FIELDS.map((field) => ({
  value: field.key,
  label: field.label,
}));

export const MATCHER_OPTIONS = [
  { value: 'contains', label: 'Contains' },
  { value: 'containsAll', label: 'Keyword AND' },
  { value: 'containsAny', label: 'Keyword OR' },
  { value: 'exact', label: 'Exact match' },
  { value: 'wildcard', label: 'Wildcard (* ?)' },
  { value: 'regex', label: 'Regex' },
];

export const RULE_LOGIC_OPTIONS = [
  { value: 'all', label: 'All conditions must match' },
  { value: 'any', label: 'Any condition can match' },
];

export const MATCHER_HELP = {
  contains: 'One stable phrase, such as "先骑后付".',
  containsAll: 'Comma, |, or new-line separated keywords. Every normal term must match. Terms starting with ! must not match.',
  containsAny: 'Comma, |, or new-line separated aliases. Any one term can match.',
  exact: 'The whole field must equal the pattern after trimming.',
  wildcard: 'Use * for any number of characters and ? for a single character.',
  regex: 'Use a regular expression when the simpler matchers are not enough.',
};

export const DEFAULT_BILL_CONFIGS = [
  {
    id: 'wechat',
    name: 'WeChat Pay',
    encoding: 'utf-8',
    headerLineNumber: 17,
    mappings: {
      transactionTime: '交易时间',
      transactionCategory: '交易类型',
      transactionType: '收/支',
      counterpartName: '交易对方',
      description: '商品',
      amount: '金额(元)',
      source: '支付方式',
      transactionStatus: '当前状态',
    },
    categoryMappings: [
      { id: createId('catmap'), source: '转账', target: 'Transfer' },
      { id: createId('catmap'), source: '零钱提现', target: 'Transfer' },
      { id: createId('catmap'), source: '退款', target: 'Refund' },
      { id: createId('catmap'), source: '商户消费', target: 'Uncategorized' },
      { id: createId('catmap'), source: '扫二维码付款', target: 'Uncategorized' },
    ],
    transactionTypeMappings: {
      income: '收入',
      expense: '支出',
    },
  },
  {
    id: 'alipay',
    name: 'Alipay',
    encoding: 'gb2312',
    headerLineNumber: 25,
    mappings: {
      transactionTime: '交易时间',
      transactionCategory: '交易分类',
      transactionType: '收/支',
      counterpartName: '交易对方',
      description: '商品说明',
      amount: '金额',
      source: '收/付款方式',
      transactionStatus: '交易状态',
    },
    categoryMappings: [
      { id: createId('catmap'), source: '餐饮美食', target: 'Food & Dining' },
      { id: createId('catmap'), source: '交通出行', target: 'Transportation' },
      { id: createId('catmap'), source: '日用百货', target: 'Shopping' },
      { id: createId('catmap'), source: '文化休闲', target: 'Entertainment' },
      { id: createId('catmap'), source: '充值缴费', target: 'Bills & Utilities' },
      { id: createId('catmap'), source: '医疗健康', target: 'Healthcare' },
      { id: createId('catmap'), source: '酒店旅游', target: 'Travel' },
      { id: createId('catmap'), source: '退款', target: 'Refund' },
      { id: createId('catmap'), source: '其他', target: 'Other' },
    ],
    transactionTypeMappings: {
      income: '收入',
      expense: '支出',
    },
  },
];

export const DEFAULT_RULES = [
  {
    id: createId('rule'),
    name: 'Meituan bike rides',
    category: 'Transportation',
    transactionType: 'Expense',
    scope: 'all',
    enabled: true,
    logic: 'all',
    notes: 'Starter example: bike rental on Meituan should not become Food.',
    conditions: [
      { id: createId('cond'), field: 'counterpartName', matcher: 'contains', pattern: '美团' },
      { id: createId('cond'), field: 'description', matcher: 'contains', pattern: '先骑后付' },
    ],
  },
  {
    id: createId('rule'),
    name: 'Meituan ride hailing',
    category: 'Transportation',
    transactionType: 'Expense',
    scope: 'all',
    enabled: true,
    logic: 'all',
    notes: 'Starter example: ride-hailing patterns sold through Meituan.',
    conditions: [
      { id: createId('cond'), field: 'counterpartName', matcher: 'contains', pattern: '美团' },
      {
        id: createId('cond'),
        field: 'description',
        matcher: 'containsAny',
        pattern: '曹操惠选,享道经济型,T3特惠',
      },
    ],
  },
  {
    id: createId('rule'),
    name: 'Powerbank rental',
    category: 'Shopping',
    transactionType: 'Expense',
    scope: 'all',
    enabled: true,
    logic: 'any',
    notes: 'Starter example: battery or powerbank rental should not inherit the platform category.',
    conditions: [
      {
        id: createId('cond'),
        field: 'description',
        matcher: 'containsAny',
        pattern: '充电宝,共享充电宝,免押租借',
      },
    ],
  },
];

export const DEFAULT_RULE_ENGINE_SETTINGS = {
  configFileName: '',
  selectedBillConfigId: DEFAULT_BILL_CONFIGS[0].id,
  billConfigs: DEFAULT_BILL_CONFIGS,
  rules: DEFAULT_RULES,
  customCategories: [],
};

export function createEmptyBillConfig(name = 'Custom bill type') {
  return {
    id: createId('bill'),
    name,
    encoding: 'utf-8',
    headerLineNumber: 1,
    mappings: REQUIRED_FIELDS.reduce((result, field) => {
      result[field.key] = '';
      return result;
    }, {}),
    categoryMappings: [],
    transactionTypeMappings: {
      income: '',
      expense: '',
    },
  };
}

export function createEmptyCategoryMapping(source = '') {
  return {
    id: createId('catmap'),
    source,
    target: '',
  };
}

export function createEmptyRuleDraft(scope = 'all', category = 'Uncategorized') {
  return {
    id: createId('rule'),
    name: '',
    category,
    transactionType: 'Expense',
    scope,
    enabled: true,
    logic: 'all',
    notes: '',
    conditions: [
      {
        id: createId('cond'),
        field: 'description',
        matcher: 'contains',
        pattern: '',
      },
    ],
  };
}

export function normalizeText(value) {
  return String(value || '')
    .replace(/\uFEFF/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getTerms(pattern) {
  return String(pattern || '')
    .split(/[\n,|]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function splitAndTerms(pattern) {
  const terms = getTerms(pattern);

  return {
    positive: terms.filter((term) => !term.startsWith('!')),
    negative: terms
      .filter((term) => term.startsWith('!'))
      .map((term) => term.slice(1))
      .filter(Boolean),
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getUniqueHeaders(headers) {
  const seen = {};

  return headers.map((header, index) => {
    const base = String(header || '').trim() || `Column ${index + 1}`;
    const count = (seen[base] || 0) + 1;
    seen[base] = count;
    return count > 1 ? `${base} (${count})` : base;
  });
}

function getCellValue(row, index) {
  return index > -1 ? String(row[index] || '').trim() : '';
}

function parseAmount(value) {
  const cleaned = String(value || '')
    .replace(/[¥￥,\s]/g, '')
    .replace(/[^\d.-]/g, '');

  if (!cleaned) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDateValue(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue.replace(/\./g, '-').replace(/\//g, '-'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function findBestCategoryName(categories, sourceCategory) {
  const normalizedSource = normalizeText(sourceCategory);
  if (!normalizedSource) {
    return '';
  }

  const exactMatch = categories.find(
    (category) => normalizeText(category.name) === normalizedSource
  );
  if (exactMatch) {
    return exactMatch.name;
  }

  const fuzzyMatch = categories.find((category) => {
    const normalizedCategory = normalizeText(category.name);
    return (
      normalizedCategory.includes(normalizedSource) ||
      normalizedSource.includes(normalizedCategory)
    );
  });

  return fuzzyMatch?.name || '';
}

export function getRuleEngineCategoryOptions(categories = [], customCategories = []) {
  const options = Array.from(
    new Set([
      ...categories.map((category) => category.name).filter(Boolean),
      ...customCategories.map((category) => String(category || '').trim()).filter(Boolean),
    ])
  ).sort((left, right) => left.localeCompare(right));

  return options.includes(IGNORE_CATEGORY_NAME)
    ? options
    : [...options, IGNORE_CATEGORY_NAME];
}

export function mapBillCategory(rawCategory, categoryMappings = [], categories = []) {
  const normalizedSource = normalizeText(rawCategory);

  if (!normalizedSource) {
    return '';
  }

  const matchedMapping = (categoryMappings || []).find(
    (mapping) => normalizeText(mapping.source) === normalizedSource
  );

  if (matchedMapping?.target) {
    return matchedMapping.target;
  }

  return findBestCategoryName(categories, rawCategory);
}

export function mapTransactionType(rawTransactionType, transactionTypeMappings = {}) {
  const normalizedType = normalizeText(rawTransactionType);

  if (!normalizedType) {
    return 'Neutral';
  }

  if (normalizeText(transactionTypeMappings?.income) === normalizedType) {
    return 'Income';
  }

  if (normalizeText(transactionTypeMappings?.expense) === normalizedType) {
    return 'Expense';
  }

  return 'Neutral';
}

function evaluateCondition(value, matcher, pattern) {
  const rawValue = String(value || '');
  const normalizedValue = normalizeText(rawValue);
  const normalizedPattern = normalizeText(pattern);

  if (!normalizedValue || !normalizedPattern) {
    return { matched: false, detail: '' };
  }

  switch (matcher) {
    case 'exact':
      return {
        matched: normalizedValue === normalizedPattern,
        detail: pattern,
      };
    case 'contains':
      return {
        matched: normalizedValue.includes(normalizedPattern),
        detail: pattern,
      };
    case 'containsAll': {
      const { positive, negative } = splitAndTerms(pattern);
      const matchedPositiveTerms = positive.filter((term) => normalizedValue.includes(term));
      const blockedNegativeTerms = negative.filter((term) => normalizedValue.includes(term));
      const matched =
        positive.length > 0 &&
        matchedPositiveTerms.length === positive.length &&
        blockedNegativeTerms.length === 0;

      return {
        matched,
        detail: matched
          ? [
              ...matchedPositiveTerms,
              ...negative.map((term) => `!${term}`),
            ].join(', ')
          : '',
      };
    }
    case 'containsAny': {
      const matchedTerms = getTerms(pattern).filter((term) => normalizedValue.includes(term));
      return {
        matched: matchedTerms.length > 0,
        detail: matchedTerms.length > 0 ? matchedTerms.join(', ') : pattern,
      };
    }
    case 'wildcard': {
      const regex = new RegExp(
        `^${escapeRegex(normalizedPattern).replace(/\\\*/g, '.*').replace(/\\\?/g, '.')}$`,
        'i'
      );

      return {
        matched: regex.test(normalizedValue),
        detail: pattern,
      };
    }
    case 'regex':
      try {
        return {
          matched: new RegExp(pattern, 'i').test(rawValue),
          detail: pattern,
        };
      } catch {
        return {
          matched: false,
          detail: '',
        };
      }
    default:
      return { matched: false, detail: '' };
  }
}

function matchesRule(transaction, rule) {
  if (!rule?.enabled) {
    return { matched: false, matchedConditions: [] };
  }

  if (rule.scope && rule.scope !== 'all' && rule.scope !== transaction.billTypeId) {
    return { matched: false, matchedConditions: [] };
  }

  if (rule.transactionType && rule.transactionType !== transaction.internalTransactionType) {
    return { matched: false, matchedConditions: [] };
  }

  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  if (conditions.length === 0) {
    return { matched: false, matchedConditions: [] };
  }

  const evaluations = conditions.map((condition) => {
    const result = evaluateCondition(transaction[condition.field], condition.matcher, condition.pattern);
    return {
      condition,
      ...result,
    };
  });

  const matched =
    rule.logic === 'any'
      ? evaluations.some((evaluation) => evaluation.matched)
      : evaluations.every((evaluation) => evaluation.matched);

  return {
    matched,
    matchedConditions: evaluations
      .filter((evaluation) => evaluation.matched)
      .map((evaluation) => ({
        id: evaluation.condition.id,
        field: evaluation.condition.field,
        matcher: evaluation.condition.matcher,
        pattern: evaluation.condition.pattern,
        detail: evaluation.detail,
      })),
  };
}

export function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  const safeLine = String(line || '').replace(/\r$/, '');

  for (let index = 0; index < safeLine.length; index += 1) {
    const char = safeLine[index];
    const nextChar = safeLine[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value));
}

export function parseBillText(text, config, categories = []) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n');

  const headerIndex = Math.max(0, Number.parseInt(config?.headerLineNumber, 10) - 1 || 0);
  const headerValues = parseCsvLine(lines[headerIndex] || '');
  const headers = getUniqueHeaders(headerValues);

  const fieldIndexes = REQUIRED_FIELDS.reduce((result, field) => {
    result[field.key] = headers.findIndex((header) => header === config?.mappings?.[field.key]);
    return result;
  }, {});

  const missingMappings = REQUIRED_FIELDS.filter((field) => fieldIndexes[field.key] === -1).map(
    (field) => field.label
  );

  const transactions = [];

  for (let lineIndex = headerIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];

    if (!rawLine || !rawLine.trim()) {
      continue;
    }

    const row = parseCsvLine(rawLine);
    const hasMappedValue = Object.values(fieldIndexes).some((index) => {
      const value = getCellValue(row, index);
      return Boolean(value);
    });

    if (!hasMappedValue) {
      continue;
    }

    const amountRaw = getCellValue(row, fieldIndexes.amount);
    const amount = parseAmount(amountRaw);
    if (amount === null) {
      continue;
    }

    const transactionTime = getCellValue(row, fieldIndexes.transactionTime);
    const description = getCellValue(row, fieldIndexes.description);
    const counterpartName = getCellValue(row, fieldIndexes.counterpartName);
    const transactionDate = parseDateValue(transactionTime);

    if (!transactionDate || (!description && !counterpartName)) {
      continue;
    }

    const transactionCategory = getCellValue(row, fieldIndexes.transactionCategory);
    const rawTransactionType = getCellValue(row, fieldIndexes.transactionType);
    const mappedBillCategory = mapBillCategory(
      transactionCategory,
      config?.categoryMappings,
      categories
    );
    const internalTransactionType = mapTransactionType(
      rawTransactionType,
      config?.transactionTypeMappings
    );
    const resolvedCategory = resolveCategoryForTransaction(
      categories,
      mappedBillCategory,
      { internalTransactionType }
    );
    const source = getCellValue(row, fieldIndexes.source);
    const transactionStatus = getCellValue(row, fieldIndexes.transactionStatus);
    const type = resolveDisplayedTransactionType(
      { internalTransactionType },
      resolvedCategory
    );

    transactions.push({
      id: lineIndex - headerIndex,
      rowNumber: lineIndex + 1,
      billTypeId: config?.id || 'custom',
      billTypeName: config?.name || 'Custom bill type',
      transactionTime,
      transactionCategory,
      transactionType: rawTransactionType,
      counterpartName,
      counterparty: counterpartName,
      description: description || 'Unknown Transaction',
      amountRaw,
      amount: Math.abs(amount),
      source,
      paymentMethod: source || 'Unknown',
      transactionStatus,
      mappedBillCategory,
      internalTransactionType,
      date: transactionDate,
      type,
      notes: counterpartName ? `Counterparty: ${counterpartName}` : '',
      categoryId: resolvedCategory?.id || null,
      categoryName: resolvedCategory?.name || mappedBillCategory || '',
      platform: config?.id || 'custom',
      rawLine,
      originalData: {
        transactionCategory,
        transactionType: rawTransactionType,
        counterpartName,
        source,
        transactionStatus,
        billTypeId: config?.id || 'custom',
        billTypeName: config?.name || 'Custom bill type',
      },
    });
  }

  return {
    headers,
    fieldIndexes,
    missingMappings,
    transactions,
  };
}

export function getPreviewLines(rawText, headerLineNumber) {
  const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
  const start = Math.max(0, Number(headerLineNumber || 1) - 4);
  const end = Math.min(lines.length, Number(headerLineNumber || 1) + 2);

  return lines.slice(start, end).map((line, index) => ({
    lineNumber: start + index + 1,
    content: line,
    isHeader: start + index + 1 === Number(headerLineNumber || 1),
  }));
}

export function applyRulesToTransactions(transactions, rules, categories = []) {
  const hitCounts = {};

  const reviewedTransactions = (transactions || []).map((transaction) => {
    let matchedRule = null;
    let matchedRuleDetails = [];

    for (const rule of rules || []) {
      const result = matchesRule(transaction, rule);
      if (result.matched) {
        matchedRule = rule;
        matchedRuleDetails = result.matchedConditions;
        break;
      }
    }

    if (matchedRule) {
      hitCounts[matchedRule.id] = (hitCounts[matchedRule.id] || 0) + 1;
    }

    const billCategorySuggestion = transaction.mappedBillCategory || '';
    const ruleSuggestedCategory = matchedRule?.category || '';
    const suggestedCategory = ruleSuggestedCategory || billCategorySuggestion || 'HTT';
    const resolvedCategory = resolveCategoryForTransaction(
      categories,
      suggestedCategory,
      transaction
    );

    return {
      ...transaction,
      suggestedCategory,
      categoryId: resolvedCategory?.id || transaction.categoryId || null,
      categoryName: resolvedCategory?.name || suggestedCategory,
      type: resolveDisplayedTransactionType(transaction, resolvedCategory),
      categorizationProcessing: false,
      matchedRuleId: matchedRule?.id || null,
      matchedRuleName: matchedRule?.name || '',
      matchedRuleDetails,
      billCategorySuggestion,
      ruleSuggestedCategory,
    };
  });

  return {
    reviewedTransactions,
    hitCounts,
  };
}

export function describeCondition(condition) {
  const fieldLabel =
    FIELD_OPTIONS.find((field) => field.value === condition.field)?.label || condition.field;
  const matcherLabel =
    MATCHER_OPTIONS.find((matcher) => matcher.value === condition.matcher)?.label || condition.matcher;

  return `${fieldLabel} · ${matcherLabel} · ${condition.pattern}`;
}

export function hydrateBillConfig(config) {
  return {
    ...createEmptyBillConfig(config?.name || 'Custom bill type'),
    ...config,
    mappings: {
      ...createEmptyBillConfig(config?.name || 'Custom bill type').mappings,
      ...(config?.mappings || {}),
    },
    categoryMappings: (config?.categoryMappings || []).map((mapping) => ({
      id: mapping.id || createId('catmap'),
      source: mapping.source || '',
      target: mapping.target || '',
    })),
    transactionTypeMappings: {
      ...createEmptyBillConfig(config?.name || 'Custom bill type').transactionTypeMappings,
      ...(config?.transactionTypeMappings || {}),
    },
  };
}

export function hydrateRule(rule) {
  return {
    ...createEmptyRuleDraft(rule?.scope || 'all', rule?.category || 'Uncategorized'),
    ...rule,
    transactionType: rule?.transactionType || 'Expense',
    conditions: (rule?.conditions || []).map((condition) => ({
      id: condition.id || createId('cond'),
      field: condition.field || 'description',
      matcher: condition.matcher || 'contains',
      pattern: condition.pattern || '',
    })),
  };
}

export function hydrateRuleEngineSettings(value = {}) {
  const billConfigs = (value.billConfigs || DEFAULT_BILL_CONFIGS).map(hydrateBillConfig);
  const rules = (value.rules || DEFAULT_RULES).map(hydrateRule);
  const importedCategories = Array.isArray(value.customCategories)
    ? value.customCategories
    : Array.isArray(value.categories)
      ? value.categories
      : [];
  const customCategories = Array.from(
    new Set(
      importedCategories
    .map((category) => String(category || '').trim())
        .filter(Boolean)
    )
  );
  const selectedConfigId = value.selectedBillConfigId || value.selectedConfigId;
  const selectedBillConfigId =
    billConfigs.find((config) => config.id === selectedConfigId)?.id || billConfigs[0]?.id || '';

  return {
    configFileName: String(value.configFileName || ''),
    selectedBillConfigId,
    billConfigs,
    rules,
    customCategories,
  };
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function quoteYamlKey(key) {
  const normalizedKey = String(key);
  return /^[A-Za-z0-9_-]+$/.test(normalizedKey)
    ? normalizedKey
    : `'${normalizedKey.replace(/'/g, "''")}'`;
}

function formatYamlScalar(value) {
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
}

function indentYamlBlock(text, indent) {
  return String(text)
    .split('\n')
    .map((line) => `${' '.repeat(indent)}${line}`)
    .join('\n');
}

function toYaml(value, indent = 0) {
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
}

export function serializeRuleEngineSettingsToYaml(settings) {
  const payload = {
    app: 'expense-tracker-rule-engine',
    version: 1,
    exportedAt: new Date().toISOString(),
    configFileName: settings.configFileName || '',
    selectedBillConfigId: settings.selectedBillConfigId,
    selectedConfigId: settings.selectedBillConfigId,
    billConfigs: settings.billConfigs,
    customCategories: settings.customCategories,
    categories: settings.customCategories,
    rules: settings.rules,
  };

  return `---\n${toYaml(payload)}\n`;
}

export async function parseRuleEngineSettingsFromYaml(text) {
  const yamlModule = await import('js-yaml');
  const parsed = yamlModule.load(text);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The YAML file is empty or invalid.');
  }

  const nextSettings = hydrateRuleEngineSettings({
    configFileName: parsed.configFileName,
    selectedBillConfigId: parsed.selectedBillConfigId,
    selectedConfigId: parsed.selectedConfigId,
    billConfigs: Array.isArray(parsed.billConfigs) ? parsed.billConfigs : [],
    customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
  });

  if (nextSettings.billConfigs.length === 0) {
    throw new Error('The YAML backup does not contain any bill configs.');
  }

  return nextSettings;
}

export async function readBillFileText(file, encoding) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx') {
    const { read, utils } = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      throw new Error('The spreadsheet has no sheet.');
    }

    return utils.sheet_to_csv(workbook.Sheets[firstSheetName], {
      blankrows: false,
    });
  }

  const buffer = await file.arrayBuffer();
  const resolvedEncoding = encoding === 'gb2312' ? 'gbk' : encoding || 'utf-8';
  return new TextDecoder(resolvedEncoding).decode(buffer);
}
