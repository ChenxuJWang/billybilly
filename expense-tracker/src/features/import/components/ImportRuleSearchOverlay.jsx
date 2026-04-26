import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { describeCondition } from '@/features/categorization/ruleEngine';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function transactionDetailRows(transaction) {
  if (!transaction) {
    return [];
  }

  return [
    ['Description', transaction.description],
    ['Counterparty', transaction.counterparty || transaction.counterpartName],
    ['Amount', `${transaction.amount} CNY`],
    ['Date', transaction.date?.toLocaleString?.() || transaction.transactionTime],
    ['Bill category', transaction.transactionCategory],
    ['Suggested category', transaction.categoryName],
    ['Payment method', transaction.paymentMethod || transaction.source],
  ].filter(([, value]) => Boolean(value));
}

export default function ImportRuleSearchOverlay({
  open,
  rules,
  transaction,
  targetCategoryName,
  onClose,
  onSelectRule,
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  const filteredRules = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    if (!normalizedQuery) {
      return rules;
    }

    return rules.filter((rule) => {
      const searchableText = [
        rule.name,
        rule.category,
        rule.transactionType,
        rule.scope,
        rule.notes,
        ...(rule.conditions || []).map((condition) =>
          `${condition.field} ${condition.matcher} ${condition.pattern}`
        ),
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(searchableText).includes(normalizedQuery);
    });
  }, [query, rules]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 px-4 py-10 backdrop-blur-sm">
      <div className="mx-auto flex max-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search rules by name, category, condition, or notes"
            className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-slate-400"
          />
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <XCircle className="h-4 w-4" />
            <span className="sr-only">Close rule search</span>
          </Button>
        </div>

        {transaction && (
          <div className="border-b bg-sky-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Import transaction context</p>
              {targetCategoryName && (
                <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">
                  Target: {targetCategoryName}
                </Badge>
              )}
            </div>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              {transactionDetailRows(transaction).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <span className="text-slate-500">{label}: </span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-y-auto p-2">
          {filteredRules.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No rules match your search.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRules.map((rule) => (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => onSelectRule(rule)}
                  className="w-full rounded-lg border border-transparent px-4 py-3 text-left transition-colors hover:border-sky-200 hover:bg-sky-50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {rule.name || 'Untitled rule'}
                    </span>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Badge variant="outline">{rule.category || 'No category'}</Badge>
                    <Badge variant="outline">{rule.transactionType || 'Any type'}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                    {(rule.conditions || []).map((condition) => describeCondition(condition)).join(' | ') ||
                      'No conditions yet'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
