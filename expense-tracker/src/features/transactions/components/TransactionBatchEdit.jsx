import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';

export default function TransactionBatchEdit({
  selectedCount,
  batchEditData,
  setBatchEditData,
  categories,
  onCancel,
  onSubmit,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Edit Transactions</CardTitle>
        <CardDescription>Edit {selectedCount} selected transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="batchCategory">Category</Label>
            <Select
              value={batchEditData.categoryId}
              onValueChange={(value) => setBatchEditData({ ...batchEditData, categoryId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="batchIncludeInBudget"
              checked={batchEditData.includeInBudget === true}
              onCheckedChange={(checked) =>
                setBatchEditData({ ...batchEditData, includeInBudget: checked })
              }
            />
            <Label htmlFor="batchIncludeInBudget">Include in Budget</Label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onSubmit}>Update {selectedCount} Transactions</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
