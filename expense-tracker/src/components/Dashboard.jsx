import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  DollarSign,
  TrendingUp,
  Calendar,
  TrendingDown
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { currentLedger } = useLedger();
  const [dashboardData, setDashboardData] = useState({
    totalBalance: 0,
    monthlySpending: 0,
    budgetRemaining: 0,
    recentTransactions: [],
    loading: true
  });

  // Calculate dashboard statistics
  const calculateDashboardStats = async () => {
    if (!currentLedger) {
      setDashboardData(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // Get current month start and end dates
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Fetch recent transactions
      const transactionsRef = collection(db, 'ledgers', currentLedger.id, 'transactions');
      const recentQuery = query(transactionsRef, orderBy('date', 'desc'), limit(5));
      const recentSnapshot = await getDocs(recentQuery);
      
      const recentTransactions = [];
      recentSnapshot.forEach((doc) => {
        const data = doc.data();
        recentTransactions.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate() || new Date()
        });
      });

      // Fetch all transactions for calculations
      const allTransactionsQuery = query(transactionsRef, orderBy('date', 'desc'));
      const allSnapshot = await getDocs(allTransactionsQuery);
      
      let totalBalance = 0;
      let monthlySpending = 0;
      
      allSnapshot.forEach((doc) => {
        const data = doc.data();
        const transactionDate = data.date?.toDate() || new Date();
        const amount = data.amount || 0;
        
        if (data.type === 'income') {
          totalBalance += amount;
        } else {
          totalBalance -= amount;
          
          // Calculate monthly spending
          if (transactionDate >= monthStart && transactionDate <= monthEnd) {
            monthlySpending += amount;
          }
        }
      });

      // Fetch current month budgets
      const budgetsRef = collection(db, 'ledgers', currentLedger.id, 'budgets');
      const budgetsQuery = query(budgetsRef, 
        where('startDate', '<=', Timestamp.fromDate(now)),
        where('endDate', '>=', Timestamp.fromDate(now))
      );
      const budgetsSnapshot = await getDocs(budgetsQuery);
      
      let totalBudget = 0;
      budgetsSnapshot.forEach((doc) => {
        const data = doc.data();
        totalBudget += data.totalAmount || 0;
      });

      const budgetRemaining = totalBudget - monthlySpending;

      setDashboardData({
        totalBalance,
        monthlySpending,
        budgetRemaining,
        recentTransactions,
        loading: false
      });

    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
      setDashboardData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    calculateDashboardStats();
  }, [currentLedger]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date) => {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  if (dashboardData.loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Badge variant="secondary" className="text-sm">
          Welcome back, {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}!
        </Badge>
      </div>
      
      {currentLedger && (
        <div className="text-sm text-gray-600">
          Current Ledger: <span className="font-medium">{currentLedger.name}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              dashboardData.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(dashboardData.totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              All time balance
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spending</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(dashboardData.monthlySpending)}
            </div>
            <p className="text-xs text-muted-foreground">
              This month's expenses
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget Remaining</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              dashboardData.budgetRemaining >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(dashboardData.budgetRemaining)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.budgetRemaining >= 0 ? 'Remaining this month' : 'Over budget'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest financial activity</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboardData.recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>No transactions yet</p>
              <p className="text-sm">Add your first transaction to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dashboardData.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-sm text-gray-500">
                      {transaction.paymentMethod} • {formatDate(transaction.date)}
                    </p>
                  </div>
                  <div className={`font-semibold ${
                    transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

