import { IGNORE_CATEGORY_NAME } from '@/features/categorization/ruleEngine';

export function getRuleCategorySections(categories, transactionType) {
  const ignoreCategories = (() => {
    const existingIgnore = categories.find((category) => category.name === IGNORE_CATEGORY_NAME);
    return existingIgnore
      ? [existingIgnore]
      : [{ id: 'ignore-special', name: IGNORE_CATEGORY_NAME, type: 'special' }];
  })();
  const expenseCategories = categories.filter(
    (category) => category.type === 'expense' && category.name !== IGNORE_CATEGORY_NAME
  );
  const incomeCategories = categories.filter(
    (category) => category.type === 'income' && category.name !== IGNORE_CATEGORY_NAME
  );

  if (transactionType === 'Expense') {
    return [
      { label: 'Special', items: ignoreCategories },
      { label: 'Expense Categories', items: expenseCategories },
    ].filter((section) => section.items.length > 0);
  }

  if (transactionType === 'Income') {
    return [
      { label: 'Special', items: ignoreCategories },
      { label: 'Income Categories', items: incomeCategories },
    ].filter((section) => section.items.length > 0);
  }

  return [
    { label: 'Special', items: ignoreCategories },
    { label: 'Expense Categories', items: expenseCategories },
    { label: 'Income Categories', items: incomeCategories },
  ].filter((section) => section.items.length > 0);
}

export function hasVisibleRuleCategoryOption(categories, transactionType, categoryName) {
  return getRuleCategorySections(categories, transactionType).some((section) =>
    section.items.some((category) => category.name === categoryName)
  );
}

export function isRuleReadyToSave(rule) {
  const hasCategory = String(rule?.category || '').trim().length > 0;
  const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
  const hasConditions = conditions.length > 0;
  const allConditionsFilled = conditions.every(
    (condition) => String(condition?.pattern || '').trim().length > 0
  );

  return hasCategory && hasConditions && allConditionsFilled;
}
