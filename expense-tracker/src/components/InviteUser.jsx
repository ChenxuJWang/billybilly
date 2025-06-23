import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { 
  UserPlus, 
  Mail, 
  X,
  Send,
  Clock,
  Check,
  Trash2,
  Users
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';
import ProfileImage from './ProfileImage';

export default function InviteUser({ ledger, onClose }) {
  const { currentUser } = useAuth();
  const { refreshLedgers } = useLedger();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [members, setMembers] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    role: 'member'
  });

  // Fetch existing invitations for this ledger
  const fetchInvitations = async () => {
    if (!ledger) return;

    try {
      const invitationsRef = collection(db, 'invitations');
      const q = query(
        invitationsRef, 
        where('ledgerId', '==', ledger.id),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const invitationList = [];
      querySnapshot.forEach((doc) => {
        invitationList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setInvitations(invitationList);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  // Fetch current members
  const fetchMembers = async () => {
    if (!ledger || !ledger.members) return;

    try {
      const usersRef = collection(db, 'users');
      const memberIds = Object.keys(ledger.members);
      
      if (memberIds.length === 0) return;

      const memberList = [];
      for (const userId of memberIds) {
        try {
          const userDoc = await getDocs(query(usersRef, where('__name__', '==', userId)));
          userDoc.forEach((doc) => {
            memberList.push({
              id: doc.id,
              ...doc.data(),
              role: ledger.members[userId]
            });
          });
        } catch (error) {
          // If user document doesn't exist, create a placeholder
          memberList.push({
            id: userId,
            email: 'Unknown User',
            displayName: 'Unknown User',
            role: ledger.members[userId]
          });
        }
      }

      setMembers(memberList);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  // Send invitation
  const sendInvitation = async () => {
    if (!currentUser || !ledger || !formData.email.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if user is already a member
    const existingMember = members.find(member => 
      member.email.toLowerCase() === formData.email.toLowerCase()
    );
    if (existingMember) {
      setError('This user is already a member of this ledger');
      return;
    }

    // Check if invitation already exists
    const existingInvitation = invitations.find(inv => 
      inv.inviteeEmail.toLowerCase() === formData.email.toLowerCase()
    );
    if (existingInvitation) {
      setError('An invitation has already been sent to this email address');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await addDoc(collection(db, 'invitations'), {
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        inviterId: currentUser.uid,
        inviterEmail: currentUser.email,
        inviterName: currentUser.displayName || currentUser.email,
        inviteeEmail: formData.email.toLowerCase(),
        role: formData.role,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      await fetchInvitations();
      setSuccess('Invitation sent successfully!');
      setFormData({ email: '', role: 'member' });
    } catch (error) {
      console.error('Error sending invitation:', error);
      setError('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  // Cancel invitation
  const cancelInvitation = async (invitationId) => {
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'invitations', invitationId));
      await fetchInvitations();
      setSuccess('Invitation cancelled successfully!');
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      setError('Failed to cancel invitation');
    } finally {
      setLoading(false);
    }
  };

  // Remove member
  const removeMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member from the ledger?')) {
      return;
    }

    try {
      setLoading(true);
      
      // Update ledger members
      const updatedMembers = { ...ledger.members };
      delete updatedMembers[memberId];

      await updateDoc(doc(db, 'ledgers', ledger.id), {
        members: updatedMembers,
        updatedAt: new Date()
      });

      await refreshLedgers();
      await fetchMembers();
      setSuccess('Member removed successfully!');
    } catch (error) {
      console.error('Error removing member:', error);
      setError('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
    fetchMembers();
  }, [ledger]);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Manage Ledger Access: {ledger?.name}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Invite New User */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                Invite New User
              </CardTitle>
              <CardDescription>
                Send an invitation to add a new member to this ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={sendInvitation}
                disabled={loading || !formData.email.trim()}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Invitation
              </Button>
            </CardContent>
          </Card>

          {/* Current Members */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Current Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <ProfileImage user={member} size="sm" />
                      <div>
                        <p className="font-medium">{member.displayName || 'Unknown User'}</p>
                        <p className="text-sm text-gray-600">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      {member.id !== currentUser.uid && member.role !== 'owner' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeMember(member.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Pending Invitations ({invitations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{invitation.inviteeEmail}</p>
                          <p className="text-sm text-gray-600">
                            Invited {new Date(invitation.createdAt.toDate()).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">{invitation.role}</Badge>
                        <Badge variant="outline">Pending</Badge>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => cancelInvitation(invitation.id)}
                          disabled={loading}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

