import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Sparkles, XCircle } from 'lucide-react';
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

function CategorySelectContent({ transaction, categories }) {
  const expenseCategories = categories.filter((category) => category.type === 'expense');
  const incomeCategories = categories.filter((category) => category.type === 'income');
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
  const [renderedPrompt, setRenderedPrompt] = useState(prompt);
  const [visible, setVisible] = useState(Boolean(prompt));

  useEffect(() => {
    if (prompt) {
      setRenderedPrompt(prompt);
      requestAnimationFrame(() => {
        setVisible(true);
      });
      return undefined;
    }

    setVisible(false);
    const timer = setTimeout(() => {
      setRenderedPrompt(null);
    }, 800);

    return () => clearTimeout(timer);
  }, [prompt]);

  if (!renderedPrompt) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-2rem))] transition-all ${
        visible
          ? 'translate-y-0 scale-100 opacity-100 duration-500 ease-out'
          : 'translate-y-4 scale-[0.98] opacity-0 duration-[800ms] ease-in'
      }`}
    >
      <div className="pointer-events-auto">
        <Card className="border-stone-200 bg-white/95 shadow-xl backdrop-blur">
          <CardHeader className="pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  {renderedPrompt.mode === 'update' ? 'Update this rule too?' : 'Save this as a rule?'}
                </CardTitle>
                <CardDescription>
                  {renderedPrompt.mode === 'update'
                    ? `You changed a rule-hit transaction. Update "${renderedPrompt.ruleName}" so future imports use this category too.`
                    : `You manually categorized an HTT transaction. Save it as a reusable rule for ${renderedPrompt.billTypeName || 'this bill type'}.`}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onDismiss} className="h-8 w-8 rounded-full">
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Dismiss rule suggestion</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm text-stone-600">
              Category: <span className="font-medium text-stone-900">{renderedPrompt.categoryName}</span>
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onDismiss}>
                Not now
              </Button>
              <Button onClick={onApply}>
                {renderedPrompt.mode === 'update' ? 'Edit Rule' : 'Create Rule'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getTransactionSelectValue(transaction, categories) {
  if (transaction.categoryName === IGNORE_CATEGORY_NAME) {
    return IGNORE_CATEGORY_VALUE;
  }

  return transaction.categoryId &&
    categories.find((category) => category.id === transaction.categoryId)
    ? transaction.categoryId
    : 'uncategorized';
}

const TransactionReviewRow = memo(function TransactionReviewRow({
  transaction,
  categories,
  registerRowElement,
  onCategoryChange,
}) {
  const [selectedValue, setSelectedValue] = useState(() =>
    getTransactionSelectValue(transaction, categories)
  );
  const originalCategoryLabel = getOriginalCategoryLabel(transaction, categories);
  const ignored = isIgnoredTransaction(transaction);

  useEffect(() => {
    setSelectedValue(getTransactionSelectValue(transaction, categories));
  }, [categories, transaction]);

  return (
    <div
      ref={(node) => registerRowElement(transaction.id, node)}
      className={`flex flex-col items-start justify-between rounded-lg border p-3 shadow-sm md:flex-row md:items-center ${
        ignored
          ? 'border-slate-300 bg-slate-100 text-slate-500'
          : isUncategorizedTransaction(transaction)
            ? 'bg-[#B2DAFF]'
            : ''
      } transition-shadow duration-150`}
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
          value={selectedValue}
          onValueChange={(value) => {
            setSelectedValue(value);
            onCategoryChange(transaction.id, value);
          }}
        >
          <SelectTrigger className="w-full md:w-[220px]">
            <SelectValue placeholder="Select Category" />
          </SelectTrigger>
          <SelectContent>
            <CategorySelectContent
              transaction={transaction}
              categories={categories}
            />
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

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
  const hasUncategorizedTransactions = displayedTransactions.some(isUncategorizedTransaction);
  const ignoredTransactionsCount = displayedTransactions.filter(isIgnoredTransaction).length;
  const totalTransactionsCount = displayedTransactions.length;
  const manualReviewCount = displayedTransactions.filter(isUncategorizedTransaction).length;
  const manualTransactionIds = useMemo(
    () =>
      displayedTransactions
        .filter(isUncategorizedTransaction)
        .map((transaction) => transaction.id),
    [displayedTransactions]
  );
  const rowRefs = useRef(new Map());
  const scrollContainerRef = useRef(null);
  const blinkTimeoutsRef = useRef(new Map());
  const [activeManualIndex, setActiveManualIndex] = useState(null);
  const [manualMarkerPositions, setManualMarkerPositions] = useState([]);

  useEffect(() => {
    if (manualTransactionIds.length === 0) {
      setActiveManualIndex(null);
      return;
    }

    setActiveManualIndex((currentIndex) =>
      typeof currentIndex === 'number'
        ? Math.min(currentIndex, manualTransactionIds.length - 1)
        : currentIndex
    );
  }, [manualTransactionIds]);

  useEffect(() => () => {
    blinkTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    blinkTimeoutsRef.current.clear();
  }, []);

  const updateManualMarkerPositions = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer || manualTransactionIds.length === 0) {
      setManualMarkerPositions([]);
      return;
    }

    const scrollHeight = scrollContainer.scrollHeight || 1;
    const nextPositions = manualTransactionIds
      .map((transactionId, index) => {
        const rowElement = rowRefs.current.get(transactionId);

        if (!rowElement) {
          return null;
        }

        const markerPosition = Math.min(
          99.5,
          Math.max(0.5, ((rowElement.offsetTop + rowElement.offsetHeight / 2) / scrollHeight) * 100)
        );

        return {
          transactionId,
          index,
          top: markerPosition,
        };
      })
      .filter(Boolean);

    setManualMarkerPositions(nextPositions);
  }, [manualTransactionIds]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updateManualMarkerPositions);

    return () => window.cancelAnimationFrame(frameId);
  }, [displayedTransactions, updateManualMarkerPositions]);

  useEffect(() => {
    window.addEventListener('resize', updateManualMarkerPositions);

    return () => window.removeEventListener('resize', updateManualMarkerPositions);
  }, [updateManualMarkerPositions]);

  const hasManualTransactions = manualTransactionIds.length > 0;

  const registerRowElement = useCallback((transactionId, node) => {
    if (node) {
      rowRefs.current.set(transactionId, node);
      return;
    }

    rowRefs.current.delete(transactionId);
  }, []);

  const blinkManualTransaction = useCallback((transactionId) => {
    const rowElement = rowRefs.current.get(transactionId);

    if (!rowElement) {
      return;
    }

    const existingTimeout = blinkTimeoutsRef.current.get(transactionId);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    rowElement.classList.remove('ring-2', 'ring-sky-300', 'ring-offset-2');
    void rowElement.offsetWidth;
    rowElement.classList.add('ring-2', 'ring-sky-300', 'ring-offset-2');

    const timeoutId = window.setTimeout(() => {
      rowElement.classList.remove('ring-2', 'ring-sky-300', 'ring-offset-2');
      blinkTimeoutsRef.current.delete(transactionId);
    }, 500);

    blinkTimeoutsRef.current.set(transactionId, timeoutId);
  }, []);

  const jumpToManualTransaction = useCallback((nextIndex) => {
    const nextTransactionId = manualTransactionIds[nextIndex];

    if (!nextTransactionId) {
      return;
    }

    setActiveManualIndex(nextIndex);
    rowRefs.current.get(nextTransactionId)?.scrollIntoView({
      behavior: 'auto',
      block: 'center',
    });
    blinkManualTransaction(nextTransactionId);
  }, [blinkManualTransaction, manualTransactionIds]);

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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Categorized Transactions</CardTitle>
              <CardDescription>Review and adjust the suggested categories before import.</CardDescription>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[720px]">
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                  Transactions
                </p>
                <p className="mt-1 text-2xl font-semibold text-stone-900">
                  {totalTransactionsCount}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Ignored
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-700">
                  {ignoredTransactionsCount}
                </p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-600">
                      Needs Manual Update
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-sky-700">
                      {manualReviewCount}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-sky-200 bg-white/80 text-sky-700"
                      disabled={!hasManualTransactions}
                      onClick={() =>
                        jumpToManualTransaction(
                          activeManualIndex === null
                            ? manualTransactionIds.length - 1
                            : (activeManualIndex - 1 + manualTransactionIds.length) %
                              manualTransactionIds.length
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only">Previous manual update</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-sky-200 bg-white/80 text-sky-700"
                      disabled={!hasManualTransactions}
                      onClick={() =>
                        jumpToManualTransaction(
                          activeManualIndex === null
                            ? 0
                            : (activeManualIndex + 1) % manualTransactionIds.length
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Next manual update</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div
              ref={scrollContainerRef}
              className="max-h-[70vh] space-y-4 overflow-y-auto pr-5"
            >
              {displayedTransactions.map((transaction) => {
                return (
                  <TransactionReviewRow
                    key={transaction.id}
                    transaction={transaction}
                    categories={categories}
                    registerRowElement={registerRowElement}
                    onCategoryChange={onCategoryChange}
                  />
                );
              })}
            </div>
            {manualMarkerPositions.length > 0 && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex w-4 justify-center">
                <div className="relative h-full w-[10px]">
                  {manualMarkerPositions.map((marker) => (
                    <button
                      key={marker.transactionId}
                      type="button"
                      className="pointer-events-auto absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-sky-500 shadow-sm transition-transform hover:scale-110"
                      style={{ top: `${marker.top}%` }}
                      onClick={() => jumpToManualTransaction(marker.index)}
                      title={`Jump to manual update ${marker.index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
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
