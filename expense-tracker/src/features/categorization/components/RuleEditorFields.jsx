import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
  getRuleCategorySections,
  hasVisibleRuleCategoryOption,
} from '@/features/categorization/utils/ruleEditor';
import {
  FIELD_OPTIONS,
  INTERNAL_TRANSACTION_TYPE_OPTIONS,
  MATCHER_HELP,
  MATCHER_OPTIONS,
  RULE_LOGIC_OPTIONS,
} from '@/features/categorization/ruleEngine';

export default function RuleEditorFields({
  rule,
  categories,
  billConfigs,
  onRuleChange,
  onAddCondition,
  onConditionChange,
  onRemoveCondition,
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2">
          <Label>Rule name</Label>
          <Input value={rule.name} onChange={(event) => onRuleChange({ name: event.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={rule.category || '__empty__'}
            onValueChange={(nextValue) =>
              onRuleChange({
                category: nextValue === '__empty__' ? '' : nextValue,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">No category yet</SelectItem>
              {getRuleCategorySections(categories, rule.transactionType || 'Expense').map((section, index) => (
                <React.Fragment key={`${rule.id}-${section.label}`}>
                  {index > 0 && <SelectSeparator />}
                  <SelectGroup>
                    <SelectLabel>{section.label}</SelectLabel>
                    {section.items.map((category) => (
                      <SelectItem
                        key={`${rule.id}-${section.label}-${category.id}`}
                        value={category.name}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </React.Fragment>
              ))}
              {rule.category &&
                !hasVisibleRuleCategoryOption(
                  categories,
                  rule.transactionType || 'Expense',
                  rule.category
                ) && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Current Value</SelectLabel>
                      <SelectItem value={rule.category}>{rule.category}</SelectItem>
                    </SelectGroup>
                  </>
                )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Transaction type</Label>
          <Select
            value={rule.transactionType || 'Expense'}
            onValueChange={(nextValue) => onRuleChange({ transactionType: nextValue })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERNAL_TRANSACTION_TYPE_OPTIONS.map((option) => (
                <SelectItem key={`${rule.id}-${option.value}`} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Scope</Label>
          <Select
            value={rule.scope || 'all'}
            onValueChange={(nextValue) => onRuleChange({ scope: nextValue })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bill types</SelectItem>
              {billConfigs.map((config) => (
                <SelectItem key={`${rule.id}-${config.id}`} value={config.id}>
                  {config.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end justify-between gap-3 rounded-md border bg-slate-50 px-3 py-2">
          <div>
            <Label className="text-sm">Enabled</Label>
            <p className="text-xs text-slate-500">
              Disable a rule without deleting it.
            </p>
          </div>
          <Switch checked={rule.enabled} onCheckedChange={(nextValue) => onRuleChange({ enabled: nextValue })} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Rule logic</Label>
          <Select
            value={rule.logic || 'all'}
            onValueChange={(nextValue) => onRuleChange({ logic: nextValue })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RULE_LOGIC_OPTIONS.map((option) => (
                <SelectItem key={`${rule.id}-${option.value}`} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={rule.notes || ''} onChange={(event) => onRuleChange({ notes: event.target.value })} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Conditions</p>
            <p className="text-sm text-slate-600">
              Pick a field, matcher, and pattern. {MATCHER_HELP.containsAll}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onAddCondition}>
            <Plus className="mr-2 h-4 w-4" />
            Add Condition
          </Button>
        </div>

        {(rule.conditions || []).map((condition) => (
          <div
            key={condition.id}
            className="grid gap-3 rounded-md border bg-white p-3 lg:grid-cols-[1fr_1fr_2fr_auto]"
          >
            <div className="space-y-2">
              <Label>Field</Label>
              <Select
                value={condition.field}
                onValueChange={(nextValue) => onConditionChange(condition.id, { field: nextValue })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((option) => (
                    <SelectItem key={`${condition.id}-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Matcher</Label>
              <Select
                value={condition.matcher}
                onValueChange={(nextValue) => onConditionChange(condition.id, { matcher: nextValue })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCHER_OPTIONS.map((option) => (
                    <SelectItem key={`${condition.id}-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {MATCHER_HELP[condition.matcher]}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Pattern</Label>
              <Textarea
                rows={2}
                value={condition.pattern}
                onChange={(event) =>
                  onConditionChange(condition.id, {
                    pattern: event.target.value,
                  })
                }
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveCondition(condition.id)}
                disabled={(rule.conditions || []).length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
