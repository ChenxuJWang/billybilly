const PLATFORM_CATEGORY_MAPPINGS = {
  alipay: {
    餐饮美食: 'Food & Dining',
    交通出行: 'Transportation',
    日用百货: 'Shopping',
    文化休闲: 'Entertainment',
    充值缴费: 'Bills & Utilities',
    医疗健康: 'Healthcare',
    酒店旅游: 'Travel',
  },
  wechat: {
    转账: 'HTT',
    零钱提现: 'HTT',
    退款: 'HTT',
    商户消费: 'HTT',
    扫二维码付款: 'HTT',
  },
};

export const DEFAULT_RULES = [
  {
    id: 'rule-meituan-bike-rides',
    name: 'Meituan bike rides',
    category: 'Transportation',
    transactionType: 'Expense',
    scope: 'all',
    enabled: true,
    logic: 'all',
    conditions: [
      { id: 'cond-meituan-merchant', field: 'counterpartName', matcher: 'contains', pattern: '美团' },
      { id: 'cond-meituan-bike', field: 'description', matcher: 'contains', pattern: '先骑后付' },
    ],
  },
  {
    id: 'rule-meituan-ride-hailing',
    name: 'Meituan ride hailing',
    category: 'Transportation',
    transactionType: 'Expense',
    scope: 'all',
    enabled: true,
    logic: 'all',
    conditions: [
      { id: 'cond-meituan-merchant-2', field: 'counterpartName', matcher: 'contains', pattern: '美团' },
      {
        id: 'cond-meituan-rides',
        field: 'description',
        matcher: 'containsAny',
        pattern: '曹操惠选,享道经济型,T3特惠',
      },
    ],
  },
  {
    id: 'rule-powerbank-rental',
    name: 'Powerbank rental',
    category: 'Shopping',
    transactionType: 'Expense',
    scope: 'all',
    enabled: true,
    logic: 'any',
    conditions: [
      {
        id: 'cond-powerbank',
        field: 'description',
        matcher: 'containsAny',
        pattern: '充电宝,共享充电宝,免押租借',
      },
    ],
  },
];

function normalizeText(value) {
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
      const positiveMatched = positive.length > 0 && matchedPositiveTerms.length === positive.length;
      const negativeMatched = blockedNegativeTerms.length === 0;

      return {
        matched: positiveMatched && negativeMatched,
        detail: matchedPositiveTerms.join(', '),
      };
    }
    case 'containsAny': {
      const matchedTerms = getTerms(pattern).filter((term) => normalizedValue.includes(term));
      return {
        matched: matchedTerms.length > 0,
        detail: matchedTerms.join(', '),
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

  if (rule.scope && rule.scope !== 'all' && rule.scope !== transaction.platform) {
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

function resolveCategory(categories, suggestedCategory) {
  const normalizedSuggestion = normalizeText(suggestedCategory);
  return (
    categories.find((category) => normalizeText(category.name) === normalizedSuggestion) || null
  );
}

function mapBillCategory(transaction) {
  const platformMappings = PLATFORM_CATEGORY_MAPPINGS[transaction.platform] || {};
  const exactCategory = platformMappings[transaction.transactionCategory];

  if (exactCategory) {
    return exactCategory;
  }

  if (transaction.categoryId && transaction.categoryName) {
    return transaction.categoryName;
  }

  return '';
}

export async function categorizeTransactionsWithRules({
  transactions,
  categories,
  rules = DEFAULT_RULES,
}) {
  const reviewedTransactions = transactions.map((transaction) => {
    let matchedRule = null;
    let matchedRuleDetails = [];

    for (const rule of rules) {
      const result = matchesRule(transaction, rule);
      if (result.matched) {
        matchedRule = rule;
        matchedRuleDetails = result.matchedConditions;
        break;
      }
    }

    const billCategorySuggestion = mapBillCategory(transaction);
    const ruleSuggestedCategory = matchedRule?.category || '';
    const suggestedCategory = ruleSuggestedCategory || billCategorySuggestion || 'HTT';
    const resolvedCategory = resolveCategory(categories, suggestedCategory);

    return {
      ...transaction,
      suggestedCategory,
      categoryId: resolvedCategory?.id || null,
      categoryName: resolvedCategory?.name || suggestedCategory,
      categorizationProcessing: false,
      matchedRuleId: matchedRule?.id || null,
      matchedRuleName: matchedRule?.name || '',
      matchedRuleDetails,
      ruleSuggestedCategory,
      billCategorySuggestion,
    };
  });

  return {
    reviewedTransactions,
    usage: null,
  };
}
