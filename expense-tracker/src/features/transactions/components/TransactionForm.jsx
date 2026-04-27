import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { ProfileImageWithName } from '@/components/ProfileImage';
import { formatCurrency } from '@/utils/currency';
import { Link2, Unlink } from 'lucide-react';
import { buildSplitPreview, ensureArray } from '@/features/transactions/utils/transactionManagement';
import { isLinkedRefundTransaction, isRefundTransaction } from '@/features/transactions/utils/refunds';

function formatRelatedDate(transaction) {
  const date = transaction?.date instanceof Date ? transaction.date : new Date(transaction?.date);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : 'Unknown date';
}

export default function TransactionForm({
  formData,
  setFormData,
  categories,
  members,
  splitMode,
  setSplitMode,
  currentLedger,
  editingTransaction,
  isMultiMemberLedger,
  onSubmit,
  onCancel,
  onOpenRefundLink,
  onUnlinkRefund,
  relatedRefundTransaction,
}) {
  const splitPreview = buildSplitPreview(formData, members);
  const canLinkRefund = editingTransaction && isRefundTransaction(formData, categories);
  const isLinkedRefund = isLinkedRefundTransaction(editingTransaction);
  const relatedRefundCategory = categories.find(
    (category) => category.id === relatedRefundTransaction?.categoryId
  );

  const handleSplitModeChange = (mode) => {
    setSplitMode(mode);

    if (mode === 'none') {
      setFormData((previous) => ({
        ...previous,
        splitType: 'none',
        splitWith: [],
      }));
      return;
    }

    if (mode === 'everyone') {
      const allMemberIds = members
        .filter((member) => member.uid !== formData.paidBy)
        .map((member) => member.uid);

      setFormData((previous) => ({
        ...previous,
        splitType: 'equal',
        splitWith: allMemberIds,
      }));
      return;
    }

    setFormData((previous) => ({
      ...previous,
      splitType: ensureArray(previous.splitWith).length > 0 ? 'equal' : 'none',
    }));
  };

  const handleSplitWithToggle = (userId) => {
    setFormData((previous) => {
      const currentSplitWith = ensureArray(previous.splitWith);
      const nextSplitWith = currentSplitWith.includes(userId)
        ? currentSplitWith.filter((id) => id !== userId)
        : [...currentSplitWith, userId];

      return {
        ...previous,
        splitWith: nextSplitWith,
        splitType: nextSplitWith.length > 0 ? 'equal' : 'none',
      };
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(event) => setFormData({ ...formData, amount: event.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                type="text"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((category) => category.type === formData.type)
                    .map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Input
                id="paymentMethod"
                type="text"
                value={formData.paymentMethod}
                onChange={(event) => setFormData({ ...formData, paymentMethod: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex items-center space-x-2">
              <Checkbox
                id="includeInBudget"
                checked={formData.includeInBudget}
                onCheckedChange={(checked) => setFormData({ ...formData, includeInBudget: checked })}
              />
              <Label htmlFor="includeInBudget">Include in Budget</Label>
            </div>
            {(canLinkRefund || isLinkedRefund) && (
              <div className="md:col-span-2 rounded-md border border-sky-100 bg-sky-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {isLinkedRefund ? 'Refund linked' : 'Refund link'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {canLinkRefund
                        ? 'Link this refund income to the original expense so analytics use the net amount.'
                        : 'This transaction is paired with a refund, so analytics use the net amount.'}
                    </p>
                    {isLinkedRefund && relatedRefundTransaction && (
                      <div className="mt-3 rounded-md border border-sky-100 bg-white/80 px-3 py-2 text-sm">
                        <p className="font-medium text-slate-900">
                          {relatedRefundTransaction.description || 'Linked transaction'}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {relatedRefundCategory?.name || relatedRefundTransaction.categoryName || 'Uncategorized'} •{' '}
                          {formatRelatedDate(relatedRefundTransaction)} •{' '}
                          {formatCurrency(
                            Math.abs(Number(relatedRefundTransaction.amount) || 0),
                            currentLedger?.currency
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isLinkedRefund && (
                      <Button type="button" variant="outline" onClick={onUnlinkRefund}>
                        <Unlink className="mr-2 h-4 w-4" />
                        Unlink
                      </Button>
                    )}
                    {canLinkRefund && (
                      <Button type="button" onClick={onOpenRefundLink}>
                        <Link2 className="mr-2 h-4 w-4" />
                        {isLinkedRefund ? 'Change Link' : 'Link Refund'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isMultiMemberLedger && formData.type === 'expense' && (
            <div className="space-y-4 rounded-md border p-4">
              <h3 className="text-lg font-semibold">Split Expense</h3>

              <div>
                <Label htmlFor="paidBy">Paid By</Label>
                <Select
                  value={formData.paidBy}
                  onValueChange={(value) => setFormData({ ...formData, paidBy: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.uid} value={member.uid}>
                        <ProfileImageWithName user={member} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={splitMode === 'none' ? 'default' : 'outline'}
                  onClick={() => handleSplitModeChange('none')}
                >
                  Don&apos;t Split
                </Button>
                <Button
                  type="button"
                  variant={splitMode === 'everyone' ? 'default' : 'outline'}
                  onClick={() => handleSplitModeChange('everyone')}
                >
                  Split Equally (Everyone Else)
                </Button>
                <Button
                  type="button"
                  variant={splitMode === 'individuals' ? 'default' : 'outline'}
                  onClick={() => handleSplitModeChange('individuals')}
                >
                  Split with Individuals
                </Button>
              </div>

              {splitMode === 'individuals' && (
                <div className="space-y-2">
                  <Label>Select Members to Split With:</Label>
                  {members
                    .filter((member) => member.uid !== formData.paidBy)
                    .map((member) => (
                      <div key={member.uid} className="flex items-center space-x-2">
                        <Checkbox
                          id={`split-with-${member.uid}`}
                          checked={ensureArray(formData.splitWith).includes(member.uid)}
                          onCheckedChange={() => handleSplitWithToggle(member.uid)}
                        />
                        <Label htmlFor={`split-with-${member.uid}`}>
                          <ProfileImageWithName user={member} />
                        </Label>
                      </div>
                    ))}
                </div>
              )}

              {splitPreview && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="font-semibold">Split Details:</h4>
                  <p>Total Amount: {formatCurrency(splitPreview.totalAmount, currentLedger?.currency)}</p>
                  <p>Paid By: <ProfileImageWithName user={splitPreview.payer} /></p>
                  <p>Splitting with {splitPreview.splitMembers.length} other(s):</p>
                  <ul>
                    {splitPreview.splitMembers.map((member) => (
                      <li key={member.uid}>
                        - <ProfileImageWithName user={member} />:{' '}
                        {formatCurrency(splitPreview.perPersonAmount, currentLedger?.currency)}
                      </li>
                    ))}
                    <li>
                      - <ProfileImageWithName user={splitPreview.payer} /> (Payer):{' '}
                      {formatCurrency(splitPreview.payerAmount, currentLedger?.currency)}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
