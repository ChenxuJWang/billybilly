import {
  applyRulesToTransactions,
  DEFAULT_RULES,
} from '@/features/categorization/ruleEngine';

export { DEFAULT_RULES } from '@/features/categorization/ruleEngine';

export async function categorizeTransactionsWithRules({
  transactions,
  categories,
  rules = DEFAULT_RULES,
}) {
  const { reviewedTransactions } = applyRulesToTransactions(transactions, rules, categories);

  return {
    reviewedTransactions,
  };
}
