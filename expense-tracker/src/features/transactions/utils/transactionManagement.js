export function createDefaultTransactionForm(userId = '') {
  return {
    amount: '',
    type: 'expense',
    description: '',
    categoryId: '',
    paymentMethod: 'cash',
    notes: '',
    includeInBudget: true,
    date: new Date().toISOString().split('T')[0],
    paidBy: userId,
    splitType: 'none',
    splitWith: [],
    splitAmounts: {},
  };
}

export function createDefaultBatchEditState() {
  return {
    categoryId: '',
    includeInBudget: null,
  };
}

export function createDefaultCategories() {
  return [
    { name: 'Food & Dining', type: 'expense' },
    { name: 'Transportation', type: 'expense' },
    { name: 'Shopping', type: 'expense' },
    { name: 'Entertainment', type: 'expense' },
    { name: 'Bills & Utilities', type: 'expense' },
    { name: 'Healthcare', type: 'expense' },
    { name: 'Salary', type: 'income' },
    { name: 'Freelance', type: 'income' },
    { name: 'Investment', type: 'income' },
  ];
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getSplitMode(splitWith, members, payerId) {
  const normalizedSplitWith = ensureArray(splitWith);
  const allOtherMemberIds = members
    .filter((member) => member.uid !== payerId)
    .map((member) => member.uid);

  if (normalizedSplitWith.length === 0) {
    return 'none';
  }

  if (
    normalizedSplitWith.length === allOtherMemberIds.length &&
    allOtherMemberIds.every((memberId) => normalizedSplitWith.includes(memberId))
  ) {
    return 'everyone';
  }

  return 'individuals';
}

export function normalizeTransactionForEdit(transaction) {
  return {
    ...transaction,
    date:
      transaction.date instanceof Date
        ? transaction.date.toISOString().split('T')[0]
        : transaction.date,
    splitWith: ensureArray(transaction.splitWith),
    splitAmounts: transaction.splitAmounts || {},
  };
}

export function groupTransactionsByMonth(transactions) {
  const groupedTransactions = {};

  transactions.forEach((transaction) => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!groupedTransactions[monthKey]) {
      groupedTransactions[monthKey] = [];
    }

    groupedTransactions[monthKey].push(transaction);
  });

  return Object.keys(groupedTransactions)
    .sort((left, right) => right.localeCompare(left))
    .map((monthKey) => {
      const [year, month] = monthKey.split('-');

      return {
        key: monthKey,
        label: new Date(year, Number(month) - 1).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        }),
        transactions: groupedTransactions[monthKey],
      };
    });
}

export function buildSplitPreview(formData, members) {
  const splitWith = ensureArray(formData.splitWith);

  if (formData.splitType !== 'equal' || splitWith.length === 0) {
    return null;
  }

  const totalAmount = Number(formData.amount || 0);
  const divisor = splitWith.length + 1;
  const perPersonAmount = divisor > 0 ? totalAmount / divisor : 0;

  return {
    totalAmount,
    payer: members.find((member) => member.uid === formData.paidBy) || null,
    splitMembers: splitWith
      .map((memberId) => members.find((member) => member.uid === memberId) || null)
      .filter(Boolean),
    perPersonAmount,
    payerAmount: totalAmount - splitWith.length * perPersonAmount,
  };
}
