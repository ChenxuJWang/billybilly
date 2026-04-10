export function buildLlmSystemPrompt(categories = []) {
  const expenseCategories = categories
    .filter((category) => category.type === 'expense')
    .map((category) => category.name);
  const incomeCategories = categories
    .filter((category) => category.type === 'income')
    .map((category) => category.name);

  const allowedCategories = [...expenseCategories, ...incomeCategories, 'HTT']
    .filter(Boolean)
    .join(', ');

  const expenseSection =
    expenseCategories.map((name) => `- ${name}`).join('\n') ||
    '- HTT: (Hard To Tell) if you cannot confidently match a ledger category';
  const incomeSection = incomeCategories.map((name) => `- ${name}`).join('\n') || '- HTT';

  return `You are a financial-data assistant. I will provide you with a CSV file of transactions containing at least the following columns: Date, Description, Amount. Respond in JSON and say nothing else:

1. For each row, determine whether it is an expense or an income.

2. Assign each transaction to one of the following categories:

Expense Categories
${expenseSection}

Income Categories
${incomeSection}

Use merchant names, keywords in the description, or amount signs to guide your choice.

3. Output a single JSON object with this exact structure:

{
  "transactions": [
    {
      "id": "<self-increment id>",
      "category": "<one of the given categories: ${allowedCategories}>"
    }
  ]
}

4. Corrections showing prior misclassifications may optionally be provided and should be followed when they are relevant.`;
}
