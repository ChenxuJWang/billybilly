import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users,
  Settings,
  Save,
  X,
  BookOpen,
  Crown,
  UserPlus
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';
import InviteUser from './InviteUser';

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '¥ Chinese Yuan (CNY)' },
  { value: 'USD', label: '$ US Dollar (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ British Pound (GBP)' },
  { value: 'JPY', label: '¥ Japanese Yen (JPY)' }
];

export default function LedgerManagement() {
  const { currentUser } = useAuth();
  const { ledgers, currentLedger, switchLedger, refreshLedgers, isOwner } = useLedger();
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLedger, setEditingLedger] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    currency: 'CNY',
    description: ''
  });

  // Create new ledger
  const createLedger = async () => {
    if (!currentUser || !formData.name.trim()) return;

    try {
      setLoading(true);
      setError('');

      const newLedger = await addDoc(collection(db, 'ledgers'), {
        name: formData.name.trim(),
        description: formData.description.trim(),
        currency: formData.currency,
        ownerId: currentUser.uid,
        createdAt: new Date(),
        members: {
          [currentUser.uid]: 'owner'
        }
      });

      await refreshLedgers();
      setSuccess('Ledger created successfully!');
      setShowCreateForm(false);
      setFormData({ name: '', currency: 'CNY', description: '' });
    } catch (error) {
      console.error('Error creating ledger:', error);
      setError('Failed to create ledger');
    } finally {
      setLoading(false);
    }
  };

  // Update ledger
  const updateLedger = async () => {
    if (!editingLedger || !formData.name.trim()) return;

    try {
      setLoading(true);
      setError('');

      await updateDoc(doc(db, 'ledgers', editingLedger.id), {
        name: formData.name.trim(),
        description: formData.description.trim(),
        currency: formData.currency,
        updatedAt: new Date()
      });

      await refreshLedgers();
      setSuccess('Ledger updated successfully!');
      setEditingLedger(null);
      setFormData({ name: '', currency: 'CNY', description: '' });
    } catch (error) {
      console.error('Error updating ledger:', error);
      setError('Failed to update ledger');
    } finally {
      setLoading(false);
    }
  };

  // Delete ledger
  const deleteLedger = async (ledgerId) => {
    if (!confirm('Are you sure you want to delete this ledger? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await deleteDoc(doc(db, 'ledgers', ledgerId));
      await refreshLedgers();
      setSuccess('Ledger deleted successfully!');
    } catch (error) {
      console.error('Error deleting ledger:', error);
      setError('Failed to delete ledger');
    } finally {
      setLoading(false);
    }
  };

  // Start editing ledger
  const startEdit = (ledger) => {
    setEditingLedger(ledger);
    setFormData({
      name: ledger.name,
      currency: ledger.currency || 'CNY',
      description: ledger.description || ''
    });
    setShowCreateForm(false);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingLedger(null);
    setShowCreateForm(false);
    setFormData({ name: '', currency: 'CNY', description: '' });
  };

  // Get user role in ledger
  const getUserRole = (ledger) => {
    if (!ledger.members || !currentUser) return null;
    return ledger.members[currentUser.uid] || null;
  };

  // Get member count
  const getMemberCount = (ledger) => {
    if (!ledger.members) return 0;
    return Object.keys(ledger.members).length;
  };

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Ledger Management</h1>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Ledger
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingLedger) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingLedger ? 'Edit Ledger' : 'Create New Ledger'}
            </CardTitle>
            <CardDescription>
              {editingLedger 
                ? 'Update the ledger details below.' 
                : 'Create a new ledger to organize your expenses separately.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Ledger Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Personal Expenses, Business Travel, Family Budget"
              />
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select 
                value={formData.currency} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this ledger's purpose"
              />
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={editingLedger ? updateLedger : createLedger}
                disabled={loading || !formData.name.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingLedger ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ledgers List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ledgers.map((ledger) => {
          const userRole = getUserRole(ledger);
          const memberCount = getMemberCount(ledger);
          const isCurrentLedger = currentLedger?.id === ledger.id;

          return (
            <Card 
              key={ledger.id} 
              className={`cursor-pointer transition-all ${
                isCurrentLedger ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
              }`}
              onClick={() => switchLedger(ledger.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center">
                      <BookOpen className="h-5 w-5 mr-2" />
                      {ledger.name}
                      {isCurrentLedger && (
                        <Badge variant="secondary" className="ml-2">Current</Badge>
                      )}
                    </CardTitle>
                    {ledger.description && (
                      <CardDescription className="mt-1">
                        {ledger.description}
                      </CardDescription>
                    )}
                  </div>
                  {userRole === 'owner' && (
                    <Crown className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Currency:</span>
                    <span className="font-medium">{ledger.currency || 'CNY'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Members:</span>
                    <span className="font-medium flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      {memberCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Role:</span>
                    <Badge variant={userRole === 'owner' ? 'default' : 'secondary'}>
                      {userRole}
                    </Badge>
                  </div>
                </div>

                {userRole === 'owner' && (
                  <div className="flex space-x-2 mt-4 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(ledger);
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLedger(ledger);
                        setShowInviteModal(true);
                      }}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Invite
                    </Button>
                    {ledgers.length > 1 && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteLedger(ledger.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {ledgers.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Ledgers Found</h3>
            <p className="text-gray-600 mb-4">
              Create your first ledger to start tracking expenses.
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Ledger
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invite User Modal */}
      {showInviteModal && selectedLedger && (
        <InviteUser 
          ledger={selectedLedger}
          onClose={() => {
            setShowInviteModal(false);
            setSelectedLedger(null);
          }}
        />
      )}
    </div>
  );
}

