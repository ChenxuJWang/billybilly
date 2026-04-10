import { callLLMCategorization } from '@/utils/llmCategorization';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function resolveCategory(categories, suggestedCategory) {
  const normalizedSuggestion = normalizeText(suggestedCategory);
  return (
    categories.find((category) => normalizeText(category.name) === normalizedSuggestion) || null
  );
}

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
    const resolvedCategory = resolveCategory(categories, suggestedCategory);

    return {
      ...transaction,
      suggestedCategory,
      categoryId: resolvedCategory?.id || null,
      categoryName: resolvedCategory?.name || suggestedCategory,
      categorizationProcessing: false,
      matchedRuleId: null,
      matchedRuleName: '',
      ruleSuggestedCategory: '',
      billCategorySuggestion: '',
    };
  });

  return {
    reviewedTransactions,
    usage: finalResults.llmUsage || null,
  };
}
