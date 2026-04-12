import {
  resolveCategoryForTransaction,
  resolveDisplayedTransactionType,
} from '@/features/categorization/utils/categoryResolution';
import { IGNORE_CATEGORY_NAME } from '@/features/categorization/ruleEngine';

export const IGNORE_CATEGORY_VALUE = '__ignore__';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function resolveCategoryByName(categories, categoryName) {
  const normalizedCategoryName = normalizeText(categoryName);
  return (
    categories.find((category) => normalizeText(category.name) === normalizedCategoryName) || null
  );
}

export function createPendingDisplayedTransactions(transactions) {
  return transactions.map((transaction) => ({
    ...transaction,
    suggestedCategory: '',
    categorizationProcessing: true,
    matchedRuleId: null,
    matchedRuleName: '',
    matchedRuleDetails: [],
    billCategorySuggestion: transaction.mappedBillCategory || '',
    ruleSuggestedCategory: '',
  }));
}

export function applySuggestedCategoryUpdates(transactions, suggestions, categories) {
  return transactions.map((transaction) => {
    const suggestion = suggestions.find(
      (candidate) => Number.parseInt(candidate.id, 10) === transaction.id
    );

    if (!suggestion) {
      return transaction;
    }

    const suggestedCategory = suggestion.category || suggestion.suggestedCategory || 'HTT';
    const resolvedCategory = resolveCategoryForTransaction(categories, suggestedCategory, transaction);

    return {
      ...transaction,
      suggestedCategory,
      categoryId: resolvedCategory?.id || null,
      categoryName: resolvedCategory?.name || suggestedCategory,
      type: resolveDisplayedTransactionType(transaction, resolvedCategory),
      categorizationProcessing: false,
    };
  });
}

export function updateReviewedCategory(transactions, transactionId, nextCategoryId, categories) {
  return transactions.map((transaction) => {
    if (transaction.id !== transactionId) {
      return transaction;
    }

    if (nextCategoryId === IGNORE_CATEGORY_VALUE) {
      return {
        ...transaction,
        categoryId: null,
        categoryName: IGNORE_CATEGORY_NAME,
      };
    }

    if (nextCategoryId === 'uncategorized') {
      return {
        ...transaction,
        categoryId: null,
        categoryName: 'HTT',
        type: resolveDisplayedTransactionType(transaction, null),
      };
    }

    const matchedCategory = categories.find((category) => category.id === nextCategoryId);
    return {
      ...transaction,
      categoryId: matchedCategory?.id || null,
      categoryName: matchedCategory?.name || 'HTT',
      type: resolveDisplayedTransactionType(transaction, matchedCategory),
    };
  });
}

export function isUncategorizedTransaction(transaction) {
  return (!transaction.categoryId && transaction.categoryName !== IGNORE_CATEGORY_NAME) || transaction.categoryName === 'HTT';
}

export function isIgnoredTransaction(transaction) {
  return transaction.categoryName === IGNORE_CATEGORY_NAME;
}
