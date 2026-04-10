import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Edit, Trash2 } from 'lucide-react';
import { ProfileImageWithName } from '@/components/ProfileImage';
import { formatCurrencyWithSign } from '@/utils/currency';
import { ensureArray, groupTransactionsByMonth } from '@/features/transactions/utils/transactionManagement';

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
  onEdit,
  onDelete,
}) {
  const groupedTransactions = groupTransactionsByMonth(transactions);

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
              {groupedTransactions.map((group) => (
                <div key={group.key}>
                  <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-300" />
                    <div className="mx-4 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                      {group.label}
                    </div>
                    <div className="flex-grow border-t border-gray-300" />
                  </div>

                  <div className="space-y-3">
                    {group.transactions.map((transaction) => {
                      const category = categories.find((item) => item.id === transaction.categoryId);
                      const payer = members.find((member) => member.uid === transaction.paidBy);
                      const splitMembers = members.filter((member) =>
                        ensureArray(transaction.splitWith).includes(member.uid)
                      );

                      return (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between rounded-md border p-4 shadow-sm"
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
                                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                    }`}
                                  >
                                    {transaction.description}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {category?.name} | {new Date(transaction.date).toLocaleDateString()}
                                  </p>
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
                                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                    }`}
                                  >
                                    {formatCurrencyWithSign(
                                      transaction.amount,
                                      currentLedger?.currency,
                                      transaction.type === 'income'
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="ml-4 flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => onEdit(transaction)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => onDelete(transaction.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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
