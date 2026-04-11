import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, LayoutDashboard, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';

export default function GlobalDashboard() {
  const { currentUser } = useAuth();
  const { ledgers, currentLedger } = useLedger();

  return (
    <div className="p-6 space-y-6">
      <section className="rounded-3xl border border-white/70 bg-gradient-to-br from-white via-rose-50 to-stone-100 p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="w-fit">
              Cross-ledger dashboard
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Dashboard</h1>
              <p className="max-w-2xl text-sm text-gray-600">
                This page will become the user-level financial summary across all ledgers. For this
                milestone, it acts as the new shell landing page and keeps the ledger-specific
                dashboard inside each ledger&apos;s Overview tab.
              </p>
            </div>
          </div>

          {currentLedger && (
            <Button asChild className="w-full sm:w-auto">
              <Link to="/overview">
                Open {currentLedger.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              What ships now
            </CardTitle>
            <CardDescription>
              The navigation shell is ready for cross-ledger vs ledger-specific workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <p>
              You now have a permanent home for an account-level dashboard without overloading the
              current ledger overview page.
            </p>
            <p>
              The next milestone can add aggregate balances, spending trends, and ledger comparison
              cards here once we design the cross-ledger data model.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Current Workspace
            </CardTitle>
            <CardDescription>
              Quick context while the cross-ledger summary is still a placeholder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Signed in as</p>
              <p className="mt-2 text-base font-semibold text-stone-900">
                {currentUser?.displayName || currentUser?.email}
              </p>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Available ledgers</p>
              <p className="mt-2 text-3xl font-semibold text-stone-900">{ledgers.length}</p>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Selected ledger</p>
              <p className="mt-2 text-base font-semibold text-stone-900">
                {currentLedger?.name || 'No ledger selected'}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-600">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                This page is intentionally lightweight for now so we can stabilize the new shell and
                ledger routing before adding the full summary experience.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
