import { createEmptyRuleDraft } from '@/features/categorization/ruleEngine';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function createConditionId() {
  return createEmptyRuleDraft().conditions[0].id;
}

function getRuleTransactionType(transaction) {
  if (transaction?.internalTransactionType === 'Income') {
    return 'Income';
  }

  if (transaction?.internalTransactionType === 'Neutral') {
    return 'Neutral';
  }

  return 'Expense';
}

function buildRuleName(baseName, existingRules = []) {
  const normalizedExistingNames = new Set(
    existingRules.map((rule) => normalizeText(rule.name)).filter(Boolean)
  );

  if (!normalizedExistingNames.has(normalizeText(baseName))) {
    return baseName;
  }

  let suffix = 2;
  let nextName = `${baseName} ${suffix}`;

  while (normalizedExistingNames.has(normalizeText(nextName))) {
    suffix += 1;
    nextName = `${baseName} ${suffix}`;
  }

  return nextName;
}

function buildRuleConditions(transaction) {
  const conditions = [];

  if (transaction?.counterpartName) {
    conditions.push({
      id: createConditionId(),
      field: 'counterpartName',
      matcher: 'contains',
      pattern: transaction.counterpartName,
    });
  }

  if (
    transaction?.description &&
    normalizeText(transaction.description) !== normalizeText(transaction.counterpartName)
  ) {
    conditions.push({
      id: createConditionId(),
      field: 'description',
      matcher: 'contains',
      pattern: transaction.description,
    });
  }

  if (conditions.length === 0 && transaction?.transactionCategory) {
    conditions.push({
      id: createConditionId(),
      field: 'transactionCategory',
      matcher: 'contains',
      pattern: transaction.transactionCategory,
    });
  }

  if (conditions.length === 0 && transaction?.source) {
    conditions.push({
      id: createConditionId(),
      field: 'source',
      matcher: 'contains',
      pattern: transaction.source,
    });
  }

  if (conditions.length === 0) {
    conditions.push({
      id: createConditionId(),
      field: 'description',
      matcher: 'contains',
      pattern: transaction?.description || transaction?.counterpartName || 'Imported transaction',
    });
  }

  return conditions;
}

export function buildCreateRuleSuggestion({ transaction, category, existingRules = [] }) {
  const draft = createEmptyRuleDraft(transaction?.billTypeId || 'all', category?.name || 'Uncategorized');
  const ruleTargetLabel = category?.name || 'Uncategorized';
  const baseName = `${transaction?.counterpartName || transaction?.description || 'Imported transaction'} to ${ruleTargetLabel}`;

  draft.name = buildRuleName(baseName, existingRules);
  draft.category = ruleTargetLabel;
  draft.transactionType = getRuleTransactionType(transaction);
  draft.scope = transaction?.billTypeId || 'all';
  draft.notes = `Created from import review for ${transaction?.billTypeName || 'this bill type'}.`;
  draft.conditions = buildRuleConditions(transaction);

  return draft;
}

export function buildUpdateRulePatch({ category }) {
  return {
    category: category?.name || 'Uncategorized',
  };
}
