import { DEFAULT_CATEGORIZATION_ENGINE } from '@/features/categorization/constants';
import { categorizeTransactionsWithLlm } from '@/features/categorization/engines/llmCategorizationEngine';
import { categorizeTransactionsWithRules } from '@/features/categorization/engines/ruleBasedCategorizationEngine';

const engines = {
  llm: {
    id: 'llm',
    label: 'LLM',
    supportsStreaming: true,
    run: categorizeTransactionsWithLlm,
  },
  rules: {
    id: 'rules',
    label: 'Rule Engine',
    supportsStreaming: false,
    run: categorizeTransactionsWithRules,
  },
};

export function getCategorizationEngine(engineId) {
  return engines[engineId] || engines[DEFAULT_CATEGORIZATION_ENGINE];
}
