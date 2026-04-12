import { callLLMCategorization } from '@/utils/llmCategorization';
import {
  resolveCategoryForTransaction,
  resolveDisplayedTransactionType,
} from '@/features/categorization/utils/categoryResolution';

export async function categorizeTransactionsWithLlm({
  transactions,
  categories,
  systemPrompt,
  apiKey,
  thinkingModeEnabled,
  signal,
  onStreamUpdate,
  onPartialResults,
  onDebugUpdate,
}) {
  const finalResults = await callLLMCategorization(
    transactions,
    systemPrompt,
    apiKey,
    onStreamUpdate,
    onPartialResults,
    signal,
    thinkingModeEnabled || false,
    onDebugUpdate
  );

  const reviewedTransactions = transactions.map((transaction) => {
    const match = finalResults.transactions.find(
      (candidate) => Number.parseInt(candidate.id, 10) === transaction.id
    );
    const suggestedCategory = match?.category || 'HTT';
    const resolvedCategory = resolveCategoryForTransaction(categories, suggestedCategory, transaction);

    return {
      ...transaction,
      suggestedCategory,
      categoryId: resolvedCategory?.id || null,
      categoryName: resolvedCategory?.name || suggestedCategory,
      type: resolveDisplayedTransactionType(transaction, resolvedCategory),
      categorizationProcessing: false,
      matchedRuleId: null,
      matchedRuleName: '',
      ruleSuggestedCategory: '',
      billCategorySuggestion: transaction.mappedBillCategory || '',
    };
  });

  return {
    reviewedTransactions,
    usage: finalResults.llmUsage || null,
  };
}
