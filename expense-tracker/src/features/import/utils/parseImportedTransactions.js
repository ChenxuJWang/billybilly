import { parseBillText, readBillFileText } from '@/features/categorization/ruleEngine';

export async function parseImportedFile({ file, billConfig, categories }) {
  if (!billConfig) {
    throw new Error('No bill config is selected for this import.');
  }

  const rawText = await readBillFileText(file, billConfig.encoding, billConfig);
  const parsed = parseBillText(rawText, billConfig, categories);

  if (parsed.missingMappings.length > 0) {
    throw new Error(
      `The selected bill config is missing mappings for: ${parsed.missingMappings.join(', ')}.`
    );
  }

  return parsed.transactions;
}
