const TRANSFER_CATEGORY_NAME = 'transfer';

export function normalizeInternalTransferAlias(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

export function getInternalTransferAliases(ledger = null) {
  const aliasGroups = ledger?.internalTransferAliases || {};

  return Object.values(aliasGroups)
    .flatMap((aliases) => (Array.isArray(aliases) ? aliases : []))
    .map(normalizeInternalTransferAlias)
    .filter(Boolean);
}

export function getInternalTransferCounterparty(transaction = {}) {
  return normalizeInternalTransferAlias(
    transaction.counterparty ||
      transaction.counterpartName ||
      transaction.originalData?.counterparty ||
      transaction.originalData?.counterpartName ||
      transaction.originalData?.交易对方 ||
      transaction.originalData?.商户名称 ||
      transaction.originalData?.收款方 ||
      ''
  );
}

function normalizeCategoryName(value) {
  return String(value || '').trim().toLowerCase();
}

export function isTransferCategory(category) {
  return normalizeCategoryName(category?.name) === TRANSFER_CATEGORY_NAME;
}

export function isInternalTransferTransaction(transaction, ledger, categories = []) {
  if (!transaction || (transaction.type !== 'income' && transaction.type !== 'expense')) {
    return false;
  }

  const aliases = new Set(getInternalTransferAliases(ledger));
  const counterparty = getInternalTransferCounterparty(transaction);

  if (!counterparty || !aliases.has(counterparty)) {
    return false;
  }

  const category = categories.find((candidate) => candidate.id === transaction.categoryId);

  return isTransferCategory(category) || normalizeCategoryName(transaction.categoryName) === TRANSFER_CATEGORY_NAME;
}

export function buildInternalTransferAnalyticsTransactions(transactions = [], ledger, categories = []) {
  return transactions.filter((transaction) => !isInternalTransferTransaction(transaction, ledger, categories));
}
