import { normalizeTransactionDate } from '@/features/transactions/utils/transactionManagement';
import { buildInternalTransferAnalyticsTransactions } from '@/features/transactions/utils/internalTransfers';

const REFUND_CATEGORY_NAME = 'refund';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * ONE_DAY_MS;
const AMOUNT_TOLERANCE = 0.01;
const SIMILAR_AMOUNT_RATIO = 0.1;
const DESCRIPTION_SIMILARITY_THRESHOLD = 0.45;

function normalizeCategoryName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, '');
}

function tokenizeText(value) {
  const normalizedText = normalizeSearchText(value);

  if (!normalizedText) {
    return [];
  }

  if (normalizedText.length <= 2) {
    return [normalizedText];
  }

  const tokens = new Set();
  for (let index = 0; index < normalizedText.length - 1; index += 1) {
    tokens.add(normalizedText.slice(index, index + 2));
  }

  return Array.from(tokens);
}

function getTextSimilarity(leftValue, rightValue) {
  const leftTokens = tokenizeText(leftValue);
  const rightTokens = tokenizeText(rightValue);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightSet = new Set(rightTokens);
  const intersectionSize = leftTokens.filter((token) => rightSet.has(token)).length;
  const unionSize = new Set([...leftTokens, ...rightTokens]).size;

  return unionSize > 0 ? intersectionSize / unionSize : 0;
}

function getComparableText(transaction) {
  return [
    transaction.description,
    transaction.notes,
    transaction.categoryName,
    transaction.transactionCategory,
    transaction.originalData?.description,
    transaction.originalData?.商品说明,
    transaction.originalData?.交易说明,
    transaction.originalData?.交易类型,
  ]
    .filter(Boolean)
    .join(' ');
}

function getCounterparty(transaction) {
  return normalizeSearchText(
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

function getDaysBetween(leftValue, rightValue) {
  const leftDate = normalizeTransactionDate(leftValue);
  const rightDate = normalizeTransactionDate(rightValue);

  if (!leftDate || !rightDate) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(leftDate.getTime() - rightDate.getTime()) / ONE_DAY_MS;
}

function getAmountDifference(leftTransaction, rightTransaction) {
  return Math.abs(
    Math.abs(Number(leftTransaction?.amount) || 0) - Math.abs(Number(rightTransaction?.amount) || 0)
  );
}

function isSimilarAmount(leftTransaction, rightTransaction) {
  const refundAmount = Math.abs(Number(leftTransaction?.amount) || 0);
  const expenseAmount = Math.abs(Number(rightTransaction?.amount) || 0);
  const difference = Math.abs(refundAmount - expenseAmount);
  const allowedDifference = Math.max(AMOUNT_TOLERANCE, expenseAmount * SIMILAR_AMOUNT_RATIO);

  return difference <= allowedDifference;
}

function getRefundCategoryId(categories = []) {
  return categories.find((category) => normalizeCategoryName(category.name) === REFUND_CATEGORY_NAME)?.id || '';
}

export function isRefundCategory(category) {
  return normalizeCategoryName(category?.name) === REFUND_CATEGORY_NAME;
}

export function isRefundTransaction(transaction, categories = []) {
  if (!transaction || transaction.type !== 'income') {
    return false;
  }

  const refundCategoryId = getRefundCategoryId(categories);

  return (
    (refundCategoryId && transaction.categoryId === refundCategoryId) ||
    normalizeCategoryName(transaction.categoryName) === REFUND_CATEGORY_NAME
  );
}

export function isLinkedRefundTransaction(transaction) {
  return Boolean(
    transaction?.specialTransactionType === 'refund' &&
      transaction?.refundLinkedTransactionId &&
      transaction?.refundRole
  );
}

export function getRelatedRefundTransaction(transaction, transactions = []) {
  if (!isLinkedRefundTransaction(transaction)) {
    return null;
  }

  return transactions.find((candidate) => candidate.id === transaction.refundLinkedTransactionId) || null;
}

export function buildRefundMatchCandidates(refundTransaction, transactions = []) {
  if (!refundTransaction) {
    return [];
  }

  const refundDate = normalizeTransactionDate(refundTransaction.date);
  const refundCounterparty = getCounterparty(refundTransaction);
  const refundText = getComparableText(refundTransaction);

  return transactions
    .filter((transaction) => {
      if (!transaction || transaction.id === refundTransaction.id) {
        return false;
      }

      return transaction.type === 'expense' && !isLinkedRefundTransaction(transaction);
    })
    .map((transaction) => {
      const daysApart = getDaysBetween(refundDate, transaction.date);
      const descriptionSimilarity = getTextSimilarity(refundText, getComparableText(transaction));
      const sameCounterparty = Boolean(refundCounterparty && refundCounterparty === getCounterparty(transaction));
      const amountDifference = getAmountDifference(refundTransaction, transaction);
      const hasSimilarAmount = isSimilarAmount(refundTransaction, transaction);
      let priority = 4;

      if (descriptionSimilarity >= DESCRIPTION_SIMILARITY_THRESHOLD && daysApart <= 1) {
        priority = 1;
      } else if (hasSimilarAmount && daysApart <= 3) {
        priority = 2;
      } else if (sameCounterparty && daysApart <= 3) {
        priority = 3;
      }

      return {
        transaction,
        daysApart,
        descriptionSimilarity,
        sameCounterparty,
        amountDifference,
        hasSimilarAmount,
        priority,
      };
    })
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      if (right.descriptionSimilarity !== left.descriptionSimilarity) {
        return right.descriptionSimilarity - left.descriptionSimilarity;
      }

      if (left.amountDifference !== right.amountDifference) {
        return left.amountDifference - right.amountDifference;
      }

      return left.daysApart - right.daysApart;
    });
}

export function filterRefundCandidatesByQuery(candidates = [], query = '') {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return candidates;
  }

  return candidates.filter(({ transaction }) => {
    const searchableText = normalizeSearchText(
      [
        transaction.description,
        transaction.notes,
        transaction.categoryName,
        transaction.paymentMethod,
        transaction.counterparty,
        transaction.counterpartName,
        transaction.originalData ? Object.values(transaction.originalData).join(' ') : '',
        transaction.amount,
      ]
        .filter(Boolean)
        .join(' ')
    );

    return searchableText.includes(normalizedQuery);
  });
}

export function buildRefundAnalyticsTransactions(transactions = [], ledger = null, categories = []) {
  const transactionMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const consumedIds = new Set();
  const analyticsTransactions = [];

  transactions.forEach((transaction) => {
    if (consumedIds.has(transaction.id)) {
      return;
    }

    if (
      transaction.specialTransactionType === 'refund' &&
      transaction.refundRole === 'original' &&
      transaction.refundLinkedTransactionId
    ) {
      const refundTransaction = transactionMap.get(transaction.refundLinkedTransactionId);

      if (refundTransaction?.type === 'income') {
        consumedIds.add(transaction.id);
        consumedIds.add(refundTransaction.id);

        const expenseAmount = Math.abs(Number(transaction.amount) || 0);
        const refundAmount = Math.abs(Number(refundTransaction.amount) || 0);
        const netAmount = expenseAmount - refundAmount;

        if (Math.abs(netAmount) <= AMOUNT_TOLERANCE) {
          return;
        }

        analyticsTransactions.push({
          ...transaction,
          id: `${transaction.id}__refund_net`,
          amount: Math.abs(netAmount),
          type: netAmount > 0 ? 'expense' : 'income',
          refundNetTransactionIds: [transaction.id, refundTransaction.id],
        });
        return;
      }
    }

    if (
      transaction.specialTransactionType === 'refund' &&
      transaction.refundRole === 'refund' &&
      transaction.refundLinkedTransactionId &&
      transactionMap.get(transaction.refundLinkedTransactionId)?.refundRole === 'original'
    ) {
      consumedIds.add(transaction.id);
      return;
    }

    analyticsTransactions.push(transaction);
  });

  return buildInternalTransferAnalyticsTransactions(analyticsTransactions, ledger, categories);
}
