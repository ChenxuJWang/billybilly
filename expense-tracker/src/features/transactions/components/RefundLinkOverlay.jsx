import { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Search, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { formatCurrency } from '@/utils/currency';
import {
  buildRefundMatchCandidates,
  filterRefundCandidatesByQuery,
} from '@/features/transactions/utils/refunds';
import { normalizeTransactionDate } from '@/features/transactions/utils/transactionManagement';

function formatDate(value) {
  const date = normalizeTransactionDate(value);
  return date ? date.toLocaleDateString() : 'Unknown date';
}

function formatDaysApart(daysApart) {
  if (!Number.isFinite(daysApart)) {
    return 'Date unknown';
  }

  if (daysApart < 0.5) {
    return 'Same day';
  }

  return `${Math.round(daysApart)} day${Math.round(daysApart) === 1 ? '' : 's'} apart`;
}

function getSuggestionLabel(candidate) {
  if (candidate.priority === 1) {
    return 'Description match';
  }

  if (candidate.priority === 2) {
    return 'Similar amount';
  }

  if (candidate.priority === 3) {
    return 'Same counterparty';
  }

  return 'Manual match';
}

export default function RefundLinkOverlay({
  open,
  refundTransaction,
  transactions,
  categories,
  currentLedger,
  onClose,
  onSelectExpense,
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

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

  const candidates = useMemo(
    () => buildRefundMatchCandidates(refundTransaction, transactions),
    [refundTransaction, transactions]
  );
  const filteredCandidates = useMemo(
    () => filterRefundCandidatesByQuery(candidates, query),
    [candidates, query]
  );

  if (!open || !refundTransaction) {
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
            placeholder="Search expenses by description, counterparty, amount, category, or notes"
            className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-slate-400"
          />
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <XCircle className="h-4 w-4" />
            <span className="sr-only">Close refund search</span>
          </Button>
        </div>

        <div className="border-b bg-sky-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">Refund transaction</p>
            <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">
              {formatCurrency(Number(refundTransaction.amount) || 0, currentLedger?.currency)}
            </Badge>
            <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">
              {formatDate(refundTransaction.date)}
            </Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-700">
            {refundTransaction.description || 'No description'}
          </p>
        </div>

        <div className="overflow-y-auto p-2">
          {filteredCandidates.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No expense transactions match your search.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCandidates.map((candidate) => {
                const transaction = candidate.transaction;
                const category = categoryMap.get(transaction.categoryId);
                const isSuggested = candidate.priority < 4;

                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => onSelectExpense(transaction)}
                    className="w-full rounded-lg border border-transparent px-4 py-3 text-left transition-colors hover:border-sky-200 hover:bg-sky-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {transaction.description || 'Untitled expense'}
                      </span>
                      <Badge variant={isSuggested ? 'default' : 'outline'}>
                        {getSuggestionLabel(candidate)}
                      </Badge>
                      <Badge variant="outline">
                        {formatCurrency(Number(transaction.amount) || 0, currentLedger?.currency)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span>{category?.name || transaction.categoryName || 'Uncategorized'}</span>
                      <span>{formatDate(transaction.date)}</span>
                      <span>{formatDaysApart(candidate.daysApart)}</span>
                      {candidate.descriptionSimilarity > 0 && (
                        <span>{Math.round(candidate.descriptionSimilarity * 100)}% description similarity</span>
                      )}
                      {candidate.sameCounterparty && <span>same counterparty</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Link this expense to the refund</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

