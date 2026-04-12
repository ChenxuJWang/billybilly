function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function getPreferredCategoryType(transaction) {
  if (transaction?.internalTransactionType === 'Income') {
    return 'income';
  }

  if (transaction?.internalTransactionType === 'Expense') {
    return 'expense';
  }

  if (transaction?.internalTransactionType === 'Neutral') {
    return 'income';
  }

  if (transaction?.type === 'income' || transaction?.type === 'expense') {
    return transaction.type;
  }

  return null;
}

export function resolveCategoryForTransaction(categories = [], categoryName, transaction = null) {
  const normalizedCategoryName = normalizeText(categoryName);

  if (!normalizedCategoryName) {
    return null;
  }

  const matchedCategories = categories.filter(
    (category) => normalizeText(category.name) === normalizedCategoryName
  );

  if (matchedCategories.length === 0) {
    return null;
  }

  const preferredType = getPreferredCategoryType(transaction);

  return matchedCategories.find((category) => category.type === preferredType) || matchedCategories[0];
}

export function resolveDisplayedTransactionType(transaction, category = null) {
  if (transaction?.internalTransactionType === 'Income') {
    return 'income';
  }

  if (transaction?.internalTransactionType === 'Expense') {
    return 'expense';
  }

  if (transaction?.internalTransactionType === 'Neutral') {
    return category?.type === 'expense' ? 'expense' : 'income';
  }

  if (category?.type === 'income' || category?.type === 'expense') {
    return category.type;
  }

  return transaction?.type === 'income' ? 'income' : 'expense';
}
