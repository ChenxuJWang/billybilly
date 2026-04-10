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
    billCategorySuggestion: '',
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
    const resolvedCategory = resolveCategoryByName(categories, suggestedCategory);

    return {
      ...transaction,
      suggestedCategory,
      categoryId: resolvedCategory?.id || null,
      categoryName: resolvedCategory?.name || suggestedCategory,
      categorizationProcessing: false,
    };
  });
}

export function updateReviewedCategory(transactions, transactionId, nextCategoryId, categories) {
  return transactions.map((transaction) => {
    if (transaction.id !== transactionId) {
      return transaction;
    }

    if (nextCategoryId === 'uncategorized') {
      return {
        ...transaction,
        categoryId: null,
        categoryName: 'HTT',
      };
    }

    const matchedCategory = categories.find((category) => category.id === nextCategoryId);
    return {
      ...transaction,
      categoryId: matchedCategory?.id || null,
      categoryName: matchedCategory?.name || 'HTT',
    };
  });
}

export function isUncategorizedTransaction(transaction) {
  return !transaction.categoryId || transaction.categoryName === 'HTT';
}
