import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CircleAlert,
  PiggyBank,
  Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { useLedgerOverviewData } from '@/hooks/useLedgerOverviewData';
import { useIsMobile } from '@/hooks/use-mobile';
import InvitationManager from '@/components/InvitationManager';
import ProfileImage, { ProfileImageGroup } from '@/components/ProfileImage';
import { formatCurrency } from '@/utils/currency';
import { buildRefundAnalyticsTransactions } from '@/features/transactions/utils/refunds';

const CATEGORY_COLORS = [
  '#1d4ed8',
  '#0f766e',
  '#ea580c',
  '#7c3aed',
  '#be123c',
  '#0891b2',
  '#65a30d',
  '#ca8a04',
];

function getMonthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

  return { start, end };
}

function isTransactionInMonth(transactionDate, now = new Date()) {
  const { start, end } = getMonthBounds(now);
  return transactionDate >= start && transactionDate < end;
}

function formatPercent(value) {
  const normalizedValue = Number.isFinite(value) ? value : 0;

  if (normalizedValue === 0) {
    return '0%';
  }

  if (normalizedValue >= 10) {
    return `${Math.round(normalizedValue)}%`;
  }

  return `${normalizedValue.toFixed(1)}%`;
}

function formatRelativeDate(date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayStart - targetStart) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays > 1 && diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return date.toLocaleDateString();
}

function clampProgress(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(value, 100));
}

function buildCategoryBreakdown(transactions, categories) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const totalsByType = {
    income: new Map(),
    expense: new Map(),
  };

  transactions.forEach((transaction) => {
    const amount = Math.abs(Number(transaction.amount) || 0);

    if (amount === 0) {
      return;
    }

    const category = categoriesById.get(transaction.categoryId);
    const type = transaction.refundNetTransactionIds
      ? transaction.type || 'expense'
      : category?.type === 'income' || category?.type === 'expense'
        ? category.type
        : transaction.type || 'expense';
    const categoryMatchesType = category?.type === type;
    const key = categoryMatchesType ? category.id : `${type}-uncategorized`;
    const existingEntry = totalsByType[type].get(key);

    if (existingEntry) {
      existingEntry.value += amount;
      return;
    }

    totalsByType[type].set(key, {
      key,
      name: categoryMatchesType ? category.name : 'Uncategorized',
      type,
      value: amount,
    });
  });

  function decorateEntries(entries, colorOffset = 0) {
    return entries
      .sort((left, right) => right.value - left.value)
      .map((entry, index) => ({
        ...entry,
        color: CATEGORY_COLORS[(index + colorOffset) % CATEGORY_COLORS.length],
      }));
  }

  return {
    income: decorateEntries(Array.from(totalsByType.income.values())),
    expense: decorateEntries(Array.from(totalsByType.expense.values()), 3),
  };
}

function buildContributionBreakdown(transactions, members, currentUser) {
  const memberMap = new Map(members.map((member) => [member.uid, member]));
  const contributionMap = new Map();

  function getMemberRecord(memberId) {
    if (contributionMap.has(memberId)) {
      return contributionMap.get(memberId);
    }

    const knownMember = memberMap.get(memberId);
    const nextRecord = {
      uid: memberId,
      user:
        knownMember ||
        (memberId === currentUser?.uid
          ? {
              uid: memberId,
              displayName: currentUser.displayName || currentUser.email || 'You',
              email: currentUser.email || '',
            }
          : {
              uid: memberId,
              displayName: `User ${memberId.slice(0, 8)}`,
              email: `${memberId.slice(0, 8)}@example.com`,
            }),
      income: 0,
      expense: 0,
    };

    contributionMap.set(memberId, nextRecord);
    return nextRecord;
  }

  transactions.forEach((transaction) => {
    const actorId = transaction.paidBy || transaction.userId || currentUser?.uid || 'unknown-user';
    const actorRecord = getMemberRecord(actorId);
    const amount = Math.abs(Number(transaction.amount) || 0);

    if (transaction.type === 'income') {
      actorRecord.income += amount;
      return;
    }

    actorRecord.expense += amount;
  });

  return Array.from(contributionMap.values())
    .filter((member) => member.income > 0 || member.expense > 0)
    .sort((left, right) => right.income + right.expense - (left.income + left.expense));
}

function getBudgetStatusVariant(budget) {
  if (budget.isOverBudget) {
    return { label: 'Over limit', variant: 'destructive' };
  }

  if (budget.isActive && budget.progress >= 90) {
    return { label: 'Near limit', variant: 'secondary' };
  }

  if (budget.isActive) {
    return { label: 'On track', variant: 'outline' };
  }

  if (budget.isUpcoming) {
    return { label: 'Upcoming', variant: 'outline' };
  }

  return { label: 'Ended', variant: 'secondary' };
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

function CategoryPieSection({ title, entries, currency, pieChartWidth, pieChartHeight }) {
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const topEntries = entries.slice(0, 3);

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
        <p className="text-sm font-semibold text-slate-900">No {title.toLowerCase()} categories</p>
        <p className="mt-2 text-sm text-slate-500">This period has no {title.toLowerCase()} transactions to chart yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{entries.length} categories represented in the chart.</p>
        </div>
        <p className="text-sm font-semibold text-slate-900">{formatCurrency(total, currency)}</p>
      </div>

      <div className="flex justify-center">
        <PieChart width={pieChartWidth} height={pieChartHeight}>
          <Tooltip
            formatter={(value, name, item) => [
              formatCurrency(Number(value) || 0, currency),
              item?.payload?.name || name,
            ]}
            contentStyle={{
              borderRadius: '12px',
              borderColor: '#e2e8f0',
              boxShadow: '0 12px 30px rgba(15, 23, 42, 0.10)',
            }}
          />
          <Pie
            data={entries}
            dataKey="value"
            nameKey="name"
            innerRadius={56}
            outerRadius={86}
            paddingAngle={1.5}
            strokeWidth={0}
          >
            {entries.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Top 3 categories</p>
          <p className="text-xs text-slate-500">The chart includes all categories in this period.</p>
        </div>
        {topEntries.map((entry) => {
          const percentage = total > 0 ? (entry.value / total) * 100 : 0;

          return (
            <div key={entry.key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <p className="truncate text-sm font-medium text-slate-900">{entry.name}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatPercent(percentage)} of {title.toLowerCase()} total</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(entry.value, currency)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransactionModeTabs({ value, onValueChange }) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="gap-0">
      <TabsList>
        <TabsTrigger value="recent">Recent</TabsTrigger>
        <TabsTrigger value="top">Top This Month</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { currentLedger } = useLedger();
  const { transactions, categories, budgets, members, loading, error } = useLedgerOverviewData(
    currentLedger,
    currentUser
  );

  const [balancePeriod, setBalancePeriod] = useState('all');
  const [breakdownPeriod, setBreakdownPeriod] = useState('all');
  const [breakdownMode, setBreakdownMode] = useState('category');
  const [transactionMode, setTransactionMode] = useState('recent');
  const isMobile = useIsMobile();

  const now = useMemo(() => new Date(), []);
  const analyticsTransactions = useMemo(
    () => buildRefundAnalyticsTransactions(transactions, currentLedger, categories),
    [categories, currentLedger, transactions]
  );

  const monthlyTransactions = useMemo(
    () => transactions.filter((transaction) => isTransactionInMonth(transaction.date, now)),
    [transactions, now]
  );
  const monthlyAnalyticsTransactions = useMemo(
    () => analyticsTransactions.filter((transaction) => isTransactionInMonth(transaction.date, now)),
    [analyticsTransactions, now]
  );

  const selectedBalanceTransactions =
    balancePeriod === 'month' ? monthlyAnalyticsTransactions : analyticsTransactions;
  const selectedBreakdownTransactions =
    breakdownPeriod === 'month' ? monthlyAnalyticsTransactions : analyticsTransactions;
  const selectedBalanceVisibleCount = balancePeriod === 'month' ? monthlyTransactions.length : transactions.length;

  const balanceSummary = useMemo(() => {
    return selectedBalanceTransactions.reduce(
      (summary, transaction) => {
        const amount = Number(transaction.amount) || 0;

        if (transaction.type === 'income') {
          summary.income += amount;
          summary.balance += amount;
        } else {
          summary.expense += amount;
          summary.balance -= amount;
        }

        return summary;
      },
      { balance: 0, income: 0, expense: 0 }
    );
  }, [selectedBalanceTransactions]);

  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(selectedBreakdownTransactions, categories),
    [selectedBreakdownTransactions, categories]
  );

  const contributionMembers = useMemo(
    () => buildContributionBreakdown(selectedBreakdownTransactions, members, currentUser),
    [selectedBreakdownTransactions, members, currentUser]
  );

  const contributionTotals = useMemo(
    () =>
      contributionMembers.reduce(
        (totals, member) => ({
          income: totals.income + member.income,
          expense: totals.expense + member.expense,
        }),
        { income: 0, expense: 0 }
      ),
    [contributionMembers]
  );

  const contributionConfig = useMemo(() => {
    return contributionMembers.reduce((config, member, index) => {
      config[member.uid] = {
        label: member.user.displayName || member.user.email || 'Unknown user',
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      };

      return config;
    }, {});
  }, [contributionMembers]);

  const contributionChartData = useMemo(() => {
    return [
      contributionMembers.reduce(
        (row, member) => {
          row[member.uid] = member.income;
          return row;
        },
        { bucket: 'Income' }
      ),
      contributionMembers.reduce(
        (row, member) => {
          row[member.uid] = member.expense;
          return row;
        },
        { bucket: 'Expense' }
      ),
    ];
  }, [contributionMembers]);

  const prioritizedBudgets = useMemo(() => {
    return budgets
      .map((budget) => {
        const budgetTransactions = analyticsTransactions.filter((transaction) => {
          return (
            transaction.includeInBudget === true &&
            transaction.type === 'expense' &&
            transaction.date >= budget.startDate &&
            transaction.date <= budget.endDate
          );
        });

        const spent = budgetTransactions.reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
        const totalAmount = Number(budget.totalAmount) || 0;
        const progress = totalAmount > 0 ? (spent / totalAmount) * 100 : 0;
        const remaining = totalAmount - spent;
        const isActive = now >= budget.startDate && now <= budget.endDate;
        const isUpcoming = now < budget.startDate;
        const isOverBudget = totalAmount > 0 && spent > totalAmount;
        const daysRemaining = Math.max(
          0,
          Math.ceil((budget.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );

        return {
          ...budget,
          spent,
          progress,
          remaining,
          isActive,
          isUpcoming,
          isOverBudget,
          daysRemaining,
        };
      })
      .sort((left, right) => {
        const leftPriority = left.isActive ? 0 : left.isUpcoming ? 1 : 2;
        const rightPriority = right.isActive ? 0 : right.isUpcoming ? 1 : 2;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        if (left.isActive && right.isActive) {
          return right.progress - left.progress;
        }

        return right.endDate.getTime() - left.endDate.getTime();
      })
      .slice(0, 4);
  }, [budgets, analyticsTransactions, now]);

  const displayedTransactions = useMemo(() => {
    if (transactionMode === 'top') {
      return [...monthlyTransactions]
        .sort((left, right) => Math.abs(right.amount || 0) - Math.abs(left.amount || 0))
        .slice(0, 5);
    }

    return transactions.slice(0, 5);
  }, [monthlyTransactions, transactionMode, transactions]);

  const actorMap = useMemo(() => new Map(members.map((member) => [member.uid, member])), [members]);

  function getTransactionActor(transaction) {
    const actorId = transaction.paidBy || transaction.userId || currentUser?.uid || 'unknown-user';
    return (
      actorMap.get(actorId) || {
        uid: actorId,
        displayName:
          actorId === currentUser?.uid
            ? currentUser?.displayName || currentUser?.email || 'You'
            : `User ${actorId.slice(0, 8)}`,
        email: actorId === currentUser?.uid ? currentUser?.email || '' : `${actorId.slice(0, 8)}@example.com`,
      }
    );
  }

  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const pieChartWidth = isMobile ? 220 : 240;
  const pieChartHeight = isMobile ? 200 : 220;
  const contributionChartWidth = isMobile ? 300 : 560;
  const contributionChartHeight = 240;

  if (!currentLedger) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-lg font-semibold text-slate-900">No ledger selected</p>
            <p className="mt-2 text-sm text-slate-500">Choose a ledger from the sidebar to view its overview.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="h-9 w-64 rounded bg-slate-200" />
            </div>
            <div className="h-10 w-40 rounded bg-slate-200" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.1fr)_minmax(280px,0.85fr)]">
            <div className="h-80 rounded-2xl bg-slate-200" />
            <div className="h-80 rounded-2xl bg-slate-200" />
            <div className="h-80 rounded-2xl bg-slate-200 xl:col-span-2 2xl:col-span-1" />
          </div>
          <div className="h-96 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <InvitationManager />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Ledger Overview</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{currentLedger.name}</h1>
            <Badge variant="outline">{transactions.length} transactions</Badge>
            <Badge variant="outline">{budgets.length} budgets</Badge>
          </div>
          <p className="max-w-2xl text-sm text-slate-500">
            Keep an eye on your balance, where money is moving, how budgets are tracking, and the
            most important activity in this ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {members.length > 0 && (
            <div className="rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <ProfileImageGroup users={members} size="xs" maxDisplay={4} />
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Currency</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{currentLedger.currency || 'USD'}</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert>
          <CircleAlert className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.1fr)_minmax(280px,0.85fr)]">
        <Card className="border-slate-200">
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-slate-500" />
                <CardTitle>Balance</CardTitle>
              </div>
              <CardDescription>
                Track the net position for this ledger across all time or just this month.
              </CardDescription>
            </div>
            <Select value={balancePeriod} onValueChange={setBalancePeriod}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time Balance</SelectItem>
                <SelectItem value="month">This Month Balance</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
                {balancePeriod === 'month' ? 'Net this month' : 'Net all time'}
              </p>
              <p
                className={`text-5xl font-semibold tracking-tight ${
                  balanceSummary.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(balanceSummary.balance, currentLedger.currency)}
              </p>
              <p className="text-sm text-slate-500">
                {selectedBalanceVisibleCount} transactions visible in this view.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <ArrowUpRight className="h-4 w-4" />
                  <p className="text-sm font-medium">Income</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">
                  {formatCurrency(balanceSummary.income, currentLedger.currency)}
                </p>
                <p className="mt-1 text-xs text-emerald-700/80">Money added to this ledger in the selected period.</p>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <ArrowDownRight className="h-4 w-4" />
                  <p className="text-sm font-medium">Expense</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-rose-700">
                  {formatCurrency(balanceSummary.expense, currentLedger.currency)}
                </p>
                <p className="mt-1 text-xs text-rose-700/80">Money spent from this ledger in the selected period.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="gap-4">
            <div className="space-y-1">
              <CardTitle>Breakdown</CardTitle>
              <CardDescription>
                Switch between category mix and member contribution without leaving the overview.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap 2xl:justify-end">
              <div className="min-w-0 flex-1 sm:min-w-[12rem] 2xl:max-w-[13rem] 2xl:flex-none">
                <Select value={breakdownMode} onValueChange={setBreakdownMode}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">By Category</SelectItem>
                    <SelectItem value="contribution">By Contribution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 flex-1 sm:min-w-[11rem] 2xl:max-w-[12rem] 2xl:flex-none">
                <Select value={breakdownPeriod} onValueChange={setBreakdownPeriod}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {breakdownMode === 'category' ? (
              categoryBreakdown.income.length === 0 && categoryBreakdown.expense.length === 0 ? (
                <EmptyState
                  title="No category breakdown yet"
                  description="Once this ledger has categorized activity, the chart will show where money is moving."
                />
              ) : (
                <div className="grid gap-6 xl:grid-cols-2">
                  <CategoryPieSection
                    title="Income"
                    entries={categoryBreakdown.income}
                    currency={currentLedger.currency}
                    pieChartWidth={pieChartWidth}
                    pieChartHeight={pieChartHeight}
                  />
                  <CategoryPieSection
                    title="Expense"
                    entries={categoryBreakdown.expense}
                    currency={currentLedger.currency}
                    pieChartWidth={pieChartWidth}
                    pieChartHeight={pieChartHeight}
                  />
                </div>
              )
            ) : contributionMembers.length === 0 ? (
              <EmptyState
                title="No contribution breakdown yet"
                description="Contribution view fills in once this ledger has transactions attributed to members."
              />
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <div className="min-w-[300px]">
                    <BarChart
                      width={contributionChartWidth}
                      height={contributionChartHeight}
                      data={contributionChartData}
                      layout="vertical"
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="bucket" axisLine={false} tickLine={false} width={74} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(Number(value) || 0, currentLedger.currency),
                          contributionConfig[name]?.label || name,
                        ]}
                        contentStyle={{
                          borderRadius: '12px',
                          borderColor: '#e2e8f0',
                          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.10)',
                        }}
                      />
                      {contributionMembers.map((member) => (
                        <Bar
                          key={member.uid}
                          dataKey={member.uid}
                          stackId="totals"
                          fill={contributionConfig[member.uid].color}
                          radius={[4, 4, 4, 4]}
                          barSize={26}
                        />
                      ))}
                    </BarChart>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { key: 'income', label: 'Income', total: contributionTotals.income },
                    { key: 'expense', label: 'Expense', total: contributionTotals.expense },
                  ].map((section) => (
                    <div key={section.key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{section.label}</p>
                        <p className="text-sm font-medium text-slate-500">
                          {formatCurrency(section.total, currentLedger.currency)}
                        </p>
                      </div>
                      <div className="mt-4 space-y-3">
                        {contributionMembers
                          .filter((member) => member[section.key] > 0)
                          .map((member) => {
                            const percentage = section.total > 0 ? (member[section.key] / section.total) * 100 : 0;

                            return (
                              <div key={`${section.key}-${member.uid}`} className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: contributionConfig[member.uid].color }}
                                  />
                                  <ProfileImage user={member.user} size="xs" className="!h-6 !w-6" />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-900">
                                      {member.user.displayName || member.user.email}
                                    </p>
                                    <p className="text-xs text-slate-500">{formatPercent(percentage)}</p>
                                  </div>
                                </div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {formatCurrency(member[section.key], currentLedger.currency)}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 xl:col-span-2 2xl:col-span-1">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-slate-500" />
              <CardTitle>Budgets</CardTitle>
            </div>
            <CardDescription>Live status for the budgets that matter most right now.</CardDescription>
          </CardHeader>
          <CardContent>
            {prioritizedBudgets.length === 0 ? (
              <EmptyState
                title="No budgets yet"
                description="Create a budget to start tracking how close this ledger is to its spending targets."
              />
            ) : (
              <div className="space-y-4">
                {prioritizedBudgets.map((budget) => {
                  const status = getBudgetStatusVariant(budget);

                  return (
                    <div key={budget.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{budget.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {budget.startDate.toLocaleDateString()} to {budget.endDate.toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                          <span>{formatCurrency(budget.spent, currentLedger.currency)} spent</span>
                          <span>{formatPercent(budget.progress)}</span>
                        </div>
                        <Progress value={clampProgress(budget.progress)} />
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(Math.abs(budget.remaining), currentLedger.currency)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {budget.remaining >= 0 ? 'remaining' : 'over budget'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {budget.isActive ? budget.daysRemaining : budget.isUpcoming ? 'Starts soon' : 'Closed'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {budget.isActive
                              ? `${budget.daysRemaining} day${budget.daysRemaining === 1 ? '' : 's'} left`
                              : budget.isUpcoming
                                ? budget.startDate.toLocaleDateString()
                                : budget.endDate.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-slate-500" />
              <CardTitle>Ledger Activity</CardTitle>
            </div>
            <CardDescription>
              Switch between the latest activity and the largest transactions in the current month.
            </CardDescription>
          </div>
          <TransactionModeTabs value={transactionMode} onValueChange={setTransactionMode} />
        </CardHeader>
        <CardContent>
          {displayedTransactions.length === 0 ? (
            <EmptyState
              title={transactionMode === 'top' ? 'No top transactions this month' : 'No recent transactions yet'}
              description={
                transactionMode === 'top'
                  ? 'Once this ledger has monthly activity, the biggest transactions will appear here.'
                  : 'Add your first transaction to start building the overview.'
              }
            />
          ) : (
            <div className="space-y-3">
              {displayedTransactions.map((transaction) => {
                const actor = getTransactionActor(transaction);
                const category = categoryMap.get(transaction.categoryId);
                const amount = Number(transaction.amount) || 0;

                return (
                  <div
                    key={transaction.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <ProfileImage user={actor} size="sm" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{transaction.description}</p>
                          {transactionMode === 'top' && (
                            <Badge variant="outline">
                              #{displayedTransactions.findIndex((item) => item.id === transaction.id) + 1}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {category?.name || 'Uncategorized'} • {transaction.paymentMethod || 'Unknown method'} •{' '}
                          {formatRelativeDate(transaction.date)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {transaction.type === 'income' ? 'Received by' : 'Paid by'}{' '}
                          {actor.displayName || actor.email}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <p
                        className={`text-lg font-semibold ${
                          transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(Math.abs(amount), currentLedger.currency)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{transaction.date.toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
