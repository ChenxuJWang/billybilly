import { Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
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

export default function ImportRuleEditorDialog({
  open,
  mode,
  ruleDraft,
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
