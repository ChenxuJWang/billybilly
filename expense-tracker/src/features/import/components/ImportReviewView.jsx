import { AlertCircle, CheckCircle, Sparkles, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import CategorizationDebugPanel from '@/features/import/components/CategorizationDebugPanel';
import {
  IGNORE_CATEGORY_VALUE,
  isIgnoredTransaction,
  isUncategorizedTransaction,
} from '@/features/import/utils/reviewTransactions';
import { resolveCategoryForTransaction } from '@/features/categorization/utils/categoryResolution';
import { IGNORE_CATEGORY_NAME } from '@/features/categorization/ruleEngine';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function formatCategoryOptionLabel(category) {
  return `${category.name} (${category.type === 'income' ? 'Income' : 'Expense'})`;
}

function getOriginalCategoryLabel(transaction, categories) {
  const originalCategoryName = transaction.billCategorySuggestion || '';
  const currentCategory = categories.find((category) => category.id === transaction.categoryId) || null;
  const originalCategory = resolveCategoryForTransaction(categories, originalCategoryName, transaction);

  if (!originalCategoryName) {
    return '';
  }

  if (originalCategory?.id && currentCategory?.id && originalCategory.id === currentCategory.id) {
    return '';
  }

  if (
    !originalCategory &&
    currentCategory &&
    normalizeText(originalCategoryName) === normalizeText(currentCategory.name)
  ) {
    return '';
  }

  return originalCategory ? formatCategoryOptionLabel(originalCategory) : originalCategoryName;
}

function TransactionTypeBadge({ transaction }) {
  const isNeutral = transaction.internalTransactionType === 'Neutral';
  const label = isNeutral ? 'neutral' : transaction.type;
  const className = isNeutral
    ? 'border-orange-200 bg-orange-100 text-orange-800'
    : transaction.type === 'expense'
      ? ''
      : '';

  return (
    <Badge variant={isNeutral ? 'outline' : transaction.type === 'expense' ? 'destructive' : 'default'} className={className}>
      {label}
    </Badge>
  );
}

function CategorySelectContent({ transaction, expenseCategories, incomeCategories }) {
  const isNeutral = transaction.internalTransactionType === 'Neutral';

  if (!isNeutral) {
    const scopedCategories = transaction.type === 'expense' ? expenseCategories : incomeCategories;

    return (
      <>
        <SelectItem value="uncategorized">Uncategorized</SelectItem>
        <SelectItem value={IGNORE_CATEGORY_VALUE}>IGNORE (skip on import)</SelectItem>
        {scopedCategories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {category.name}
          </SelectItem>
        ))}
      </>
    );
  }

  return (
    <>
      <SelectItem value="uncategorized">Uncategorized</SelectItem>
      <SelectItem value={IGNORE_CATEGORY_VALUE}>IGNORE (skip on import)</SelectItem>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Income Categories</SelectLabel>
        {incomeCategories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {formatCategoryOptionLabel(category)}
          </SelectItem>
        ))}
      </SelectGroup>
      <SelectSeparator />
      <SelectGroup>
        <SelectLabel>Expense Categories</SelectLabel>
        {expenseCategories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            {formatCategoryOptionLabel(category)}
          </SelectItem>
        ))}
      </SelectGroup>
    </>
  );
}

function RuleSuggestionPrompt({ prompt, onDismiss, onApply }) {
  if (!prompt) {
    return null;
  }

  const title =
    prompt.mode === 'update' ? 'Update this rule too?' : 'Save this as a rule?';
  const description =
    prompt.mode === 'update'
      ? `You changed a rule-hit transaction. Update "${prompt.ruleName}" so future imports use this category too.`
      : `You manually categorized an HTT transaction. Save it as a reusable rule for ${prompt.billTypeName || 'this bill type'}.`;
  const actionLabel = prompt.mode === 'update' ? 'Update Rule' : 'Save Rule';

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))]">
      <Card className="border-stone-200 bg-white/95 shadow-xl backdrop-blur">
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-amber-500" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-8 w-8 rounded-full">
              <XCircle className="h-4 w-4" />
              <span className="sr-only">Dismiss rule suggestion</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm text-stone-600">
            Category: <span className="font-medium text-stone-900">{prompt.categoryName}</span>
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onDismiss}>
              Not now
            </Button>
            <Button onClick={onApply}>{actionLabel}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ImportReviewView({
  displayedTransactions,
  categories,
  error,
  onCancel,
  onConfirm,
  onCategoryChange,
  ruleSuggestionPrompt,
  onDismissRuleSuggestion,
  onApplyRuleSuggestion,
  showDebug,
  debugPanelProps,
}) {
  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const incomeCategories = categories.filter((category) => category.type === 'income');
  const hasUncategorizedTransactions = displayedTransactions.some(isUncategorizedTransaction);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Review Categorization</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onCancel} className="flex items-center space-x-2">
            <XCircle className="h-4 w-4" />
            <span>Cancel Import</span>
          </Button>
          <Button
            onClick={onConfirm}
            className="flex items-center space-x-2"
            disabled={hasUncategorizedTransactions}
          >
            <CheckCircle className="h-4 w-4" />
            <span>Confirm Import</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Categorized Transactions</CardTitle>
          <CardDescription>Review and adjust the suggested categories before import.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {displayedTransactions.map((transaction) => {
              const originalCategoryLabel = getOriginalCategoryLabel(transaction, categories);
              const ignored = isIgnoredTransaction(transaction);

              return (
                <div
                  key={transaction.id}
                  className={`flex flex-col items-start justify-between rounded-lg border p-3 shadow-sm md:flex-row md:items-center ${
                    ignored
                      ? 'border-slate-300 bg-slate-100 text-slate-500'
                      : isUncategorizedTransaction(transaction)
                        ? 'bg-[#B2DAFF]'
                        : ''
                  }`}
                >
                  <div className="mb-2 flex-1 md:mb-0">
                    <div className={`text-lg font-medium ${ignored ? 'text-slate-600' : ''}`}>{transaction.description}</div>
                    <div className={`text-sm ${ignored ? 'text-slate-500' : 'text-gray-600'}`}>
                      {transaction.date.toLocaleString()} • {transaction.amount} CNY
                      {transaction.counterparty && ` • ${transaction.counterparty}`}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <TransactionTypeBadge transaction={transaction} />
                      {ignored && <Badge variant="outline" className="border-slate-300 bg-slate-200 text-slate-700">ignored</Badge>}
                      {transaction.matchedRuleName && (
                        <span className={`text-sm ${ignored ? 'text-slate-500' : 'text-gray-500'}`}>
                          Matched rule: <span className="font-medium">{transaction.matchedRuleName}</span>
                        </span>
                      )}
                      {originalCategoryLabel && (
                        <span className={`text-sm ${ignored ? 'text-slate-500' : 'text-gray-500'}`}>
                          Original: <span className="font-medium">{originalCategoryLabel}</span>
                        </span>
                      )}
                      {ignored && (
                        <span className="text-sm text-slate-500">
                          This transaction will be skipped unless you choose another category.
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full flex-col items-start gap-2 md:w-auto md:min-w-[220px]">
                    <Select
                      value={
                        transaction.categoryName === IGNORE_CATEGORY_NAME
                          ? IGNORE_CATEGORY_VALUE
                          : transaction.categoryId &&
                            categories.find((category) => category.id === transaction.categoryId)
                          ? transaction.categoryId
                          : 'uncategorized'
                      }
                      onValueChange={(value) => onCategoryChange(transaction.id, value)}
                    >
                      <SelectTrigger className="w-full md:w-[220px]">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <CategorySelectContent
                          transaction={transaction}
                          expenseCategories={expenseCategories}
                          incomeCategories={incomeCategories}
                        />
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {showDebug && <CategorizationDebugPanel {...debugPanelProps} />}

      <RuleSuggestionPrompt
        prompt={ruleSuggestionPrompt}
        onDismiss={onDismissRuleSuggestion}
        onApply={onApplyRuleSuggestion}
      />
    </div>
  );
}
