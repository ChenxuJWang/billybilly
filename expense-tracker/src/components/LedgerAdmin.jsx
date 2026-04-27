import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import {
  BookOpen,
  Crown,
  Mail,
  PencilLine,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import InviteUser from '@/components/InviteUser.jsx';
import { useAuth } from '@/contexts/AuthContext';
import { useLedger } from '@/contexts/LedgerContext';
import { useToastNotifications } from '@/hooks/useToastNotifications';
import { db } from '@/firebase';
import { ProfileImageGroup } from '@/components/ProfileImage';

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '¥ Chinese Yuan (CNY)' },
  { value: 'USD', label: '$ US Dollar (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ British Pound (GBP)' },
  { value: 'JPY', label: '¥ Japanese Yen (JPY)' },
];

function formatAliasDrafts(aliasGroups = {}) {
  return Object.fromEntries(
    Object.entries(aliasGroups).map(([memberId, aliases]) => [
      memberId,
      Array.isArray(aliases) ? aliases.join(', ') : '',
    ])
  );
}

function parseAliasDrafts(aliasDrafts = {}) {
  return Object.fromEntries(
    Object.entries(aliasDrafts).map(([memberId, value]) => [
      memberId,
      String(value || '')
        .split(/[,\n，、;；]+/)
        .map((alias) => alias.trim())
        .filter(Boolean),
    ])
  );
}

export default function LedgerAdmin() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { ledgers, currentLedger, refreshLedgers, switchLedger } = useLedger();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [aliasDrafts, setAliasDrafts] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    currency: 'CNY',
    description: '',
  });

  const isOwner = currentLedger && currentUser
    ? currentLedger.members?.[currentUser.uid] === 'owner'
    : false;

  useEffect(() => {
    setFormData({
      name: currentLedger?.name || '',
      currency: currentLedger?.currency || 'CNY',
      description: currentLedger?.description || '',
    });
    setAliasDrafts(formatAliasDrafts(currentLedger?.internalTransferAliases || {}));
    setIsEditing(false);
  }, [currentLedger]);

  useEffect(() => {
    async function fetchMembers() {
      if (!currentLedger?.members) {
        setMembers([]);
        return;
      }

      try {
        const memberIds = Object.keys(currentLedger.members);
        const memberList = [];

        for (const memberId of memberIds) {
          const snapshot = await getDocs(
            query(collection(db, 'users'), where('__name__', '==', memberId))
          );

          if (!snapshot.empty) {
            snapshot.forEach((memberDoc) => {
              memberList.push({
                uid: memberDoc.id,
                ...memberDoc.data(),
                role: currentLedger.members[memberId],
              });
            });
            continue;
          }

          if (memberId === currentUser?.uid) {
            memberList.push({
              uid: memberId,
              displayName: currentUser.displayName || currentUser.email,
              email: currentUser.email,
              role: currentLedger.members[memberId],
            });
            continue;
          }

          memberList.push({
            uid: memberId,
            displayName: `User ${memberId.slice(0, 8)}`,
            email: `${memberId.slice(0, 8)}@example.com`,
            role: currentLedger.members[memberId],
          });
        }

        setMembers(memberList);
      } catch (memberError) {
        console.error('Error loading ledger members:', memberError);
      }
    }

    fetchMembers();
  }, [currentLedger, currentUser]);

  useToastNotifications({
    success,
    error,
    onSuccessShown: setSuccess,
    onErrorShown: setError,
  });

  async function handleSave() {
    if (!currentLedger || !formData.name.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await updateDoc(doc(db, 'ledgers', currentLedger.id), {
        name: formData.name.trim(),
        currency: formData.currency,
        description: formData.description.trim(),
        updatedAt: new Date(),
      });

      await refreshLedgers();
      await switchLedger(currentLedger.id);
      setSuccess('Ledger details updated.');
      setIsEditing(false);
    } catch (saveError) {
      console.error('Error updating ledger:', saveError);
      setError('Failed to update ledger details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAliases() {
    if (!currentLedger || !isOwner) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await updateDoc(doc(db, 'ledgers', currentLedger.id), {
        internalTransferAliases: parseAliasDrafts(aliasDrafts),
        updatedAt: new Date(),
      });

      await refreshLedgers();
      await switchLedger(currentLedger.id);
      setSuccess('Internal transfer aliases updated.');
    } catch (saveError) {
      console.error('Error updating transfer aliases:', saveError);
      setError('Failed to update internal transfer aliases.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!currentLedger) {
      return;
    }

    if (!window.confirm(`Delete "${currentLedger.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      await deleteDoc(doc(db, 'ledgers', currentLedger.id));
      await refreshLedgers();

      const remainingLedger = ledgers.find((ledger) => ledger.id !== currentLedger.id);
      if (remainingLedger) {
        await switchLedger(remainingLedger.id);
      }

      navigate('/');
    } catch (deleteError) {
      console.error('Error deleting ledger:', deleteError);
      setError('Failed to delete ledger.');
      setLoading(false);
    }
  }

  if (!currentLedger) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Ledger Admin</CardTitle>
            <CardDescription>Select or create a ledger to manage settings and access.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-900">Ledger Admin</h1>
          <p className="text-sm text-gray-600">
            Manage the selected ledger&apos;s identity, membership, and workspace rules.
          </p>
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </Button>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <PencilLine className="mr-2 h-4 w-4" />
                Edit Ledger
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={loading || !formData.name.trim()}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Ledger Details
            </CardTitle>
            <CardDescription>
              Core metadata for the currently selected ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ledger-name">Ledger name</Label>
              <Input
                id="ledger-name"
                value={formData.name}
                onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                disabled={!isOwner || !isEditing || loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ledger-currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData((current) => ({ ...current, currency: value }))}
                disabled={!isOwner || !isEditing || loading}
              >
                <SelectTrigger id="ledger-currency">
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

            <div className="space-y-2">
              <Label htmlFor="ledger-description">Description</Label>
              <Input
                id="ledger-description"
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                placeholder="What is this ledger used for?"
                disabled={!isOwner || !isEditing || loading}
              />
            </div>

            {isEditing && (
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={loading || !formData.name.trim()}>
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      name: currentLedger.name || '',
                      currency: currentLedger.currency || 'CNY',
                      description: currentLedger.description || '',
                    });
                    setIsEditing(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Access Snapshot
              </CardTitle>
              <CardDescription>The quick view of who can work in this ledger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Your role</p>
                  <p className="mt-2 text-lg font-semibold text-stone-900">
                    {isOwner ? 'Owner' : currentLedger.members?.[currentUser?.uid] || 'Member'}
                  </p>
                </div>
                {isOwner ? <Crown className="h-5 w-5 text-amber-500" /> : <Users className="h-5 w-5 text-stone-500" />}
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Members</p>
                  <p className="mt-2 text-lg font-semibold text-stone-900">{members.length}</p>
                </div>
                <ProfileImageGroup users={members} size="sm" maxDisplay={4} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                Ownership-level actions that affect the entire ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                Deleting a ledger removes its workspace and cannot be undone.
              </div>
              <Button
                variant="destructive"
                disabled={!isOwner || ledgers.length <= 1 || loading}
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Ledger
              </Button>
              {ledgers.length <= 1 && (
                <p className="text-xs text-gray-500">
                  Keep at least one ledger in the account before deleting this one.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members
          </CardTitle>
          <CardDescription>Everyone who currently has access to this ledger.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div
              key={member.uid}
              className="flex flex-col gap-2 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-stone-900">{member.displayName || member.email}</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-stone-600">
                  <Mail className="h-4 w-4" />
                  <span>{member.email || 'Unknown email'}</span>
                </div>
              </div>
              <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>{member.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRoundCheck className="h-5 w-5" />
            Internal Transfer Aliases
          </CardTitle>
          <CardDescription>
            Counterparty names that should be treated as ledger-member transfers when categorized as Transfer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
            Use the names exactly as they appear in imported bank or wallet statements. Separate multiple aliases
            with commas.
          </div>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={`aliases-${member.uid}`}
                className="grid gap-2 rounded-2xl border border-stone-200 p-4 lg:grid-cols-[220px_1fr]"
              >
                <div>
                  <p className="font-medium text-stone-900">{member.displayName || member.email}</p>
                  <p className="text-sm text-stone-500">{member.email || member.uid}</p>
                </div>
                <Input
                  value={aliasDrafts[member.uid] || ''}
                  onChange={(event) =>
                    setAliasDrafts((current) => ({
                      ...current,
                      [member.uid]: event.target.value,
                    }))
                  }
                  placeholder="Example: Alipay name, bank card name"
                  disabled={!isOwner || loading}
                />
              </div>
            ))}
          </div>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveAliases} disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Save Aliases'}
              </Button>
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => setAliasDrafts(formatAliasDrafts(currentLedger.internalTransferAliases || {}))}
              >
                <X className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showInviteModal && (
        <InviteUser
          ledger={currentLedger}
          onClose={() => {
            setShowInviteModal(false);
            refreshLedgers();
          }}
        />
      )}
    </div>
  );
}
