export const CATEGORIZATION_ENGINE_OPTIONS = [
  {
    value: 'rules',
    label: 'Rule Engine',
    description: 'Deterministic local categorization using editable bill configs and rules.',
  },
  {
    value: 'llm',
    label: 'LLM',
    description: 'Doubao-based categorization with streaming feedback.',
  },
];

export const DEFAULT_CATEGORIZATION_ENGINE = 'rules';

export function getCategorizationEngineLabel(engineId) {
  return (
    CATEGORIZATION_ENGINE_OPTIONS.find((option) => option.value === engineId)?.label ||
    'Categorizer'
  );
}
