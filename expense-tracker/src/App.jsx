import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { 
  Home, 
  CreditCard, 
  PieChart, 
  Users, 
  Upload, 
  Cog,
  Menu,
  X,
  DollarSign,
  TrendingUp,
  Calendar,
  LogOut,
  Tag,
  BookOpen
} from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LedgerProvider } from './contexts/LedgerContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './components/Login'
import Signup from './components/Signup'
import Dashboard from './components/Dashboard'
import TransactionManagement from './components/TransactionManagement'
import BudgetManagement from './components/BudgetManagement'
import CategoryManagement from './components/CategoryManagement'
import LedgerManagement from './components/LedgerManagement'
import DataImport from './components/DataImport'
import './App.css'

// Navigation Component
function Navigation({ isMobileMenuOpen, setIsMobileMenuOpen }) {
  const location = useLocation()
  const { currentUser, logout } = useAuth()
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/transactions', label: 'Transactions', icon: CreditCard },
    { path: '/budgets', label: 'Budgets', icon: PieChart },
    { path: '/categories', label: 'Categories', icon: Tag },
    { path: '/ledgers', label: 'Ledgers', icon: BookOpen },
    { path: '/splits', label: 'Expense Splits', icon: Users },
    { path: '/import', label: 'Import', icon: Upload },
    { path: '/settings', label: 'Settings', icon: Cog },
  ]

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Failed to log out:', error)
    }
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">ExpenseTracker</span>
            </div>
            <div className="flex space-x-6">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
          
          {currentUser && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {currentUser.displayName || currentUser.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">ExpenseTracker</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
        
        {isMobileMenuOpen && (
          <div className="border-t border-gray-200 px-4 py-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            
            {currentUser && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-3 px-3 py-2 w-full justify-start"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            )}
          </div>
        )}
      </nav>
    </>
  )
}

// Placeholder Components
function Transactions() {
  return <TransactionManagement />
}

function Budgets() {
  return <BudgetManagement />
}

function Categories() {
  return <CategoryManagement />
}

function ExpenseSplits() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Expense Splits</h1>
      <Card>
        <CardHeader>
          <CardTitle>Split Expenses</CardTitle>
          <CardDescription>Share expenses with friends and track balances</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Expense splitting interface will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Import() {
  return <DataImport />
}

function AppSettings() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Manage your preferences and account settings</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Settings interface will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Main App Component
function AppContent() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { currentUser } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {currentUser && (
        <Navigation 
          isMobileMenuOpen={isMobileMenuOpen} 
          setIsMobileMenuOpen={setIsMobileMenuOpen} 
        />
      )}
      
      <main className={currentUser ? "max-w-7xl mx-auto" : ""}>
        <Routes>
          <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
          <Route path="/signup" element={currentUser ? <Navigate to="/" /> : <Signup />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/transactions" element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          } />
          <Route path="/budgets" element={
            <ProtectedRoute>
              <Budgets />
            </ProtectedRoute>
          } />
          <Route path="/categories" element={
            <ProtectedRoute>
              <Categories />
            </ProtectedRoute>
          } />
          <Route path="/ledgers" element={
            <ProtectedRoute>
              <LedgerManagement />
            </ProtectedRoute>
          } />
          <Route path="/splits" element={
            <ProtectedRoute>
              <ExpenseSplits />
            </ProtectedRoute>
          } />
          <Route path="/import" element={
            <ProtectedRoute>
              <Import />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <AppSettings />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <LedgerProvider>
          <AppContent />
        </LedgerProvider>
      </AuthProvider>
    </Router>
  )
}

export default App

