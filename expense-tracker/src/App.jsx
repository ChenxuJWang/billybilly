import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LedgerProvider } from '@/contexts/LedgerContext';
import AppShell from '@/components/AppShell.jsx';
import GlobalDashboard from '@/components/GlobalDashboard.jsx';
import LedgerAdmin from '@/components/LedgerAdmin.jsx';
import UserSettingsPage from '@/components/UserSettingsPage.jsx';
import './App.css';

const Login = lazy(() => import('./components/Login'));
const Signup = lazy(() => import('./components/Signup'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const TransactionManagement = lazy(() => import('./components/TransactionManagement'));
const BudgetManagement = lazy(() => import('./components/BudgetManagement'));
const CategoryManagement = lazy(() => import('./components/CategoryManagement'));
const DataImport = lazy(() => import('./components/DataImport'));

function RouteFallback() {
  return (
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200"></div>
        <div className="h-40 rounded bg-gray-200"></div>
      </div>
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function ExpenseSplits() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Splits</h1>
      <Card>
        <CardHeader>
          <CardTitle>Expense Splits</CardTitle>
          <CardDescription>Share expenses with friends and track balances per ledger.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Expense splitting improvements can continue inside the new ledger shell.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Import({ debugModeEnabled, thinkingModeEnabled }) {
  return withSuspense(
    <DataImport debugModeEnabled={debugModeEnabled} thinkingModeEnabled={thinkingModeEnabled} />
  );
}

function AuthRoutes() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : withSuspense(<Login />)} />
      <Route path="/signup" element={currentUser ? <Navigate to="/" replace /> : withSuspense(<Signup />)} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function AppRoutes() {
  const { currentUser } = useAuth();
  const [debugModeEnabled, setDebugModeEnabled] = useState(false);
  const [smartCategorizationEnabled, setSmartCategorizationEnabled] = useState(false);
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(false);

  if (!currentUser) {
    return <AuthRoutes />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="/" element={<GlobalDashboard />} />
        <Route path="/overview" element={withSuspense(<Dashboard />)} />
        <Route path="/transactions" element={withSuspense(<TransactionManagement />)} />
        <Route path="/budgets" element={withSuspense(<BudgetManagement />)} />
        <Route path="/categories" element={withSuspense(<CategoryManagement />)} />
        <Route path="/splits" element={<ExpenseSplits />} />
        <Route
          path="/import"
          element={<Import debugModeEnabled={debugModeEnabled} thinkingModeEnabled={thinkingModeEnabled} />}
        />
        <Route path="/admin" element={<LedgerAdmin />} />
        <Route
          path="/settings"
          element={
            <UserSettingsPage
              smartCategorizationEnabled={smartCategorizationEnabled}
              setSmartCategorizationEnabled={setSmartCategorizationEnabled}
              debugModeEnabled={debugModeEnabled}
              setDebugModeEnabled={setDebugModeEnabled}
              thinkingModeEnabled={thinkingModeEnabled}
              setThinkingModeEnabled={setThinkingModeEnabled}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <LedgerProvider>
          <AppRoutes />
        </LedgerProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
