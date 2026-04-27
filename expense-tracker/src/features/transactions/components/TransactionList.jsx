import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { ChevronLeft, ChevronRight, Edit, Link2, Pin, Trash2, Unlink } from 'lucide-react';
import { ProfileImageWithName } from '@/components/ProfileImage';
import { formatCurrency, formatCurrencyWithSign } from '@/utils/currency';
import {
  ensureArray,
  groupTransactionsByMonth,
  normalizeTransactionDate,
} from '@/features/transactions/utils/transactionManagement';
import {
  getRelatedRefundTransaction,
  isLinkedRefundTransaction,
  isRefundTransaction,
} from '@/features/transactions/utils/refunds';
import { isInternalTransferTransaction } from '@/features/transactions/utils/internalTransfers';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthNavigatorPopover({ groupedTransactions, currentMonthKey, onSelectMonth }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const monthsByYear = useMemo(() => {
    const grouped = new Map();

    groupedTransactions.forEach((group) => {
      const [year, month] = group.key.split('-');
      const monthIndex = Number(month) - 1;

      if (!grouped.has(year)) {
        grouped.set(year, new Set());
      }

      grouped.get(year).add(monthIndex);
    });

    return Array.from(grouped.entries())
      .sort((left, right) => Number(right[0]) - Number(left[0]))
      .map(([year, monthSet]) => ({
        year,
        months: MONTH_LABELS.map((label, monthIndex) => ({
          monthNumber: monthIndex + 1,
          key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
          label,
          available: monthSet.has(monthIndex),
        })).reverse(),
      }));
  }, [groupedTransactions]);
  const [selectedYear, setSelectedYear] = useState(() => currentMonthKey.split('-')[0]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedYear(currentMonthKey.split('-')[0]);
  }, [currentMonthKey, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const selectedYearIndex = monthsByYear.findIndex((yearGroup) => yearGroup.year === selectedYear);
  const fallbackYearIndex = selectedYearIndex === -1 ? 0 : selectedYearIndex;
  const activeYearGroup = monthsByYear[fallbackYearIndex] || null;
  const canSelectPreviousYear = fallbackYearIndex < monthsByYear.length - 1;
  const canSelectNextYear = fallbackYearIndex > 0;

  return (
    <div ref={containerRef} className="relative mx-4">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
      >
        {groupedTransactions.find((group) => group.key === currentMonthKey)?.label || currentMonthKey}
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-20 mt-2 w-80 -translate-x-1/2 rounded-md border bg-white p-4 shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Jump to Month</p>
              <p className="text-xs text-slate-500">Only months with transactions are clickable.</p>
            </div>
            {activeYearGroup && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!canSelectPreviousYear}
                    onClick={() => setSelectedYear(monthsByYear[fallbackYearIndex + 1].year)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Older year</span>
                  </Button>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-900">{activeYearGroup.year}</p>
                    <p className="text-xs text-slate-500">
                      {fallbackYearIndex + 1} of {monthsByYear.length}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!canSelectNextYear}
                    onClick={() => setSelectedYear(monthsByYear[fallbackYearIndex - 1].year)}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Newer year</span>
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {activeYearGroup.months.map((month) => (
                    <button
                      key={month.key}
                      type="button"
                      disabled={!month.available}
                      onClick={() => {
                        if (!month.available) {
                          return;
                        }

                        onSelectMonth(month.key);
                        setOpen(false);
                      }}
                      className={`rounded-md border px-2 py-2 text-sm transition-colors ${
                        month.key === currentMonthKey
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : month.available
                            ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                            : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {month.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionList({
  transactions,
  categories,
  members,
  selectedTransactions,
  currentLedger,
  onToggleSelection,
  onSelectAll,
  onShowBatchEdit,
  onBatchDelete,
  onTogglePin,
  onOpenRefundLink,
  onUnlinkRefund,
  onEdit,
  onDelete,
}) {
  const pinnedTransactions = useMemo(
    () =>
      [...transactions]
        .filter((transaction) => transaction.pinned)
        .sort(
          (left, right) =>
            (normalizeTransactionDate(right.date)?.getTime() || 0) -
            (normalizeTransactionDate(left.date)?.getTime() || 0)
        ),
    [transactions]
  );
  const unpinnedTransactions = useMemo(
    () => transactions.filter((transaction) => !transaction.pinned),
    [transactions]
  );
  const groupedTransactions = groupTransactionsByMonth(unpinnedTransactions);
  const monthSectionRefs = useRef(new Map());

  function registerMonthSection(monthKey, node) {
    if (node) {
      monthSectionRefs.current.set(monthKey, node);
      return;
    }

    monthSectionRefs.current.delete(monthKey);
  }

  function jumpToMonth(monthKey) {
    monthSectionRefs.current.get(monthKey)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function renderTransactionRow(transaction) {
    const category = categories.find((item) => item.id === transaction.categoryId);
    const payer = members.find((member) => member.uid === transaction.paidBy);
    const splitMembers = members.filter((member) =>
      ensureArray(transaction.splitWith).includes(member.uid)
    );
    const isLinkedRefund = isLinkedRefundTransaction(transaction);
    const relatedRefundTransaction = getRelatedRefundTransaction(transaction, transactions);
    const isRefundIncome = isLinkedRefund && transaction.refundRole === 'refund';
    const isRefundedExpense = isLinkedRefund && transaction.refundRole === 'original';
    const isInternalTransfer = isInternalTransferTransaction(transaction, currentLedger, categories);
    const canManageRefundLink = isRefundTransaction(transaction, categories);
    const refundAmount = Number(relatedRefundTransaction?.amount) || 0;
    const expenseAmount = Number(transaction.amount) || 0;
    const isFullyRefunded =
      isRefundedExpense && Math.abs(Math.abs(expenseAmount) - Math.abs(refundAmount)) <= 0.01;

    return (
      <div
        key={transaction.id}
        className={`group flex items-center justify-between rounded-md border p-4 shadow-sm ${
          isRefundIncome || isInternalTransfer ? 'bg-slate-50 text-slate-500' : ''
        }`}
      >
        <div className="flex flex-1 items-center space-x-3">
          <Checkbox
            checked={selectedTransactions.includes(transaction.id)}
            onCheckedChange={() => onToggleSelection(transaction.id)}
          />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <p
                  className={`font-semibold ${
                    isRefundIncome
                      ? 'text-slate-500 line-through'
                      : isInternalTransfer
                        ? 'text-slate-500'
                      : transaction.type === 'income'
                        ? 'text-green-600'
                        : 'text-red-600'
                  }`}
                >
                  {transaction.description}
                </p>
                <p className="text-sm text-gray-500">
                  {category?.name} | {new Date(transaction.date).toLocaleDateString()}
                </p>
                {isRefundIncome && relatedRefundTransaction && (
                  <p className="text-sm text-slate-500">
                    Refund for: {relatedRefundTransaction.description || 'linked expense'}
                  </p>
                )}
                {isInternalTransfer && (
                  <p className="text-sm font-medium text-slate-500">
                    Internal Transfer
                  </p>
                )}
                {transaction.type === 'expense' && transaction.splitType !== 'none' && (
                  <p className="text-sm text-gray-500">
                    Paid by: <ProfileImageWithName user={payer} />
                    {splitMembers.length > 0 && (
                      <span>
                        , Split with:{' '}
                        {splitMembers.map((member) => member.displayName || member.email).join(', ')}
                      </span>
                    )}
                  </p>
                )}
                {transaction.type === 'income' && (
                  <p className="text-sm text-gray-500">
                    Paid to: <ProfileImageWithName user={payer} />
                  </p>
                )}
              </div>
              <div className="text-right">
                <p
                  className={`text-lg font-semibold ${
                    isRefundIncome
                      ? 'text-slate-500 line-through'
                      : isInternalTransfer
                        ? 'text-slate-500'
                      : transaction.type === 'income'
                        ? 'text-green-600'
                        : 'text-red-600'
                  }`}
                >
                  {formatCurrencyWithSign(
                    transaction.amount,
                    currentLedger?.currency,
                    transaction.type === 'income'
                  )}
                </p>
                {isRefundedExpense && relatedRefundTransaction && (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    {isFullyRefunded
                      ? 'Refunded in full'
                      : `Refunded ${formatCurrency(Math.abs(refundAmount), currentLedger?.currency)}`}
                  </p>
                )}
                {isInternalTransfer && (
                  <p className="mt-1 text-xs font-medium text-slate-500">Internal Transfer</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="ml-4 flex space-x-2">
          <Button
            variant={transaction.pinned ? 'default' : 'outline'}
            size="sm"
            onClick={() => onTogglePin(transaction)}
            className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <Pin className="h-4 w-4" />
            <span className="sr-only">{transaction.pinned ? 'Unpin transaction' : 'Pin transaction'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(transaction)}>
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit transaction</span>
          </Button>
          {canManageRefundLink && (
            <Button variant="outline" size="sm" onClick={() => onOpenRefundLink(transaction)}>
              <Link2 className="h-4 w-4" />
              <span className="sr-only">
                {isRefundIncome ? 'Change refund link' : 'Link refund'}
              </span>
            </Button>
          )}
          {isLinkedRefund && (
            <Button variant="outline" size="sm" onClick={() => onUnlinkRefund(transaction)}>
              <Unlink className="h-4 w-4" />
              <span className="sr-only">Unlink refund</span>
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => onDelete(transaction.id)}>
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete transaction</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Transactions</CardTitle>
        <CardDescription>Manage your ledger&apos;s financial records.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onSelectAll}>
              {selectedTransactions.length === transactions.length ? 'Deselect All' : 'Select All'}
            </Button>
            {selectedTransactions.length > 0 && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={onShowBatchEdit}
                  className="flex items-center space-x-2"
                >
                  <Edit className="h-4 w-4" />
                  <span>Batch Edit ({selectedTransactions.length})</span>
                </Button>
                <Button variant="destructive" onClick={onBatchDelete}>
                  Delete Selected ({selectedTransactions.length})
                </Button>
              </div>
            )}
          </div>

          {transactions.length === 0 ? (
            <p>No transactions found. Add one above!</p>
          ) : (
            <div className="space-y-4">
              {pinnedTransactions.length > 0 && (
                <div>
                  <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-300" />
                    <div className="mx-4 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                      Pinned Transactions
                    </div>
                    <div className="flex-grow border-t border-gray-300" />
                  </div>

                  <div className="space-y-3">
                    {pinnedTransactions.map((transaction) => renderTransactionRow(transaction))}
                  </div>
                </div>
              )}

              {groupedTransactions.map((group) => (
                <div key={group.key} ref={(node) => registerMonthSection(group.key, node)}>
                  <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-300" />
                    <MonthNavigatorPopover
                      groupedTransactions={groupedTransactions}
                      currentMonthKey={group.key}
                      onSelectMonth={jumpToMonth}
                    />
                    <div className="flex-grow border-t border-gray-300" />
                  </div>

                  <div className="space-y-3">
                    {group.transactions.map((transaction) => renderTransactionRow(transaction))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
