import { Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import RuleEditorFields from '@/features/categorization/components/RuleEditorFields';
import { isRuleReadyToSave } from '@/features/categorization/utils/ruleEditor';

function transactionDetailRows(transaction) {
  if (!transaction) {
    return [];
  }

  return [
    ['Description', transaction.description],
    ['Counterparty', transaction.counterparty || transaction.counterpartName],
    ['Amount', `${transaction.amount} CNY`],
    ['Date', transaction.date?.toLocaleString?.() || transaction.transactionTime],
    ['Bill category', transaction.transactionCategory],
    ['Current category', transaction.categoryName],
    ['Payment method', transaction.paymentMethod || transaction.source],
  ].filter(([, value]) => Boolean(value));
}

export default function ImportRuleEditorDialog({
  open,
  mode,
  ruleDraft,
  transactionContext,
  categories,
  billConfigs,
  saving,
  error,
  onOpenChange,
  onRuleChange,
  onAddCondition,
  onConditionChange,
  onRemoveCondition,
  onSave,
}) {
  if (!ruleDraft) {
    return null;
  }

  const readyToSave = isRuleReadyToSave(ruleDraft);
  const title = mode === 'update' ? 'Update Rule' : 'Create Rule';
  const description =
    mode === 'update'
      ? 'Adjust the existing rule, then save and re-run categorization with the updated rule.'
      : 'Review the suggested rule details, then save and re-run categorization with the new rule.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {transactionContext && (
          <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Import transaction context</p>
              {transactionContext.categoryName && (
                <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">
                  Current: {transactionContext.categoryName}
                </Badge>
              )}
            </div>
            <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
              {transactionDetailRows(transactionContext).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <span className="text-slate-500">{label}: </span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <RuleEditorFields
          rule={ruleDraft}
          categories={categories}
          billConfigs={billConfigs}
          onRuleChange={onRuleChange}
          onAddCondition={onAddCondition}
          onConditionChange={onConditionChange}
          onRemoveCondition={onRemoveCondition}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!readyToSave || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving and Re-running...' : mode === 'update' ? 'Save and Re-run' : 'Create and Re-run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
