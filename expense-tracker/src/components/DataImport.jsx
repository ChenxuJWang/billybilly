import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Download,
  Smartphone,
  CreditCard,
  Bot
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';

// Import platform configurations
const IMPORT_PLATFORMS = [
  {
    id: 'alipay',
    name: 'Alipay (支付宝)',
    icon: CreditCard,
    description: 'Import transactions from Alipay CSV export',
    fileFormat: 'CSV',
    encoding: 'GB2312',
    currency: 'CNY',
    sampleFields: ['交易时间', '交易分类', '交易对方', '商品说明', '收/支', '金额', '收/付款方式', '交易状态']
  },
  {
    id: 'wechat',
    name: 'WeChat Pay (微信支付)',
    icon: Smartphone,
    description: 'Import transactions from WeChat Pay CSV export',
    fileFormat: 'CSV',
    encoding: 'UTF-8',
    currency: 'CNY',
    sampleFields: ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态']
  },
  {
    id: 'generic',
    name: 'Generic LLM Parser',
    icon: Bot,
    description: 'AI-powered parser for any transaction format',
    fileFormat: 'CSV, TXT, PDF',
    encoding: 'Auto-detect',
    currency: 'Auto-detect',
    sampleFields: ['AI will automatically detect and map fields']
  }
];

// Category mapping for automatic categorization
const CATEGORY_MAPPING = {
  alipay: {
    '日用百货': 'Shopping',
    '交通出行': 'Transportation',
    '文化休闲': 'Entertainment',
    '充值缴费': 'Bills & Utilities',
    '餐饮美食': 'Food & Dining',
    '医疗健康': 'Healthcare',
    '教育培训': 'Education',
    '旅游度假': 'Travel',
    '运动健身': 'Fitness',
    '美容美发': 'Personal Care'
  },
  wechat: {
    '商户消费': 'Shopping',
    '转账': 'Transfer',
    '红包': 'Gift',
    '充值': 'Bills & Utilities',
    '提现': 'Transfer',
    '理财': 'Investment'
  }
};

export default function DataImport() {
  const { currentUser } = useAuth();
  const { currentLedger, canEdit } = useLedger();
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch categories for mapping
  const fetchCategories = async () => {
    if (!currentLedger) return;

    try {
      const categoriesRef = collection(db, 'ledgers', currentLedger.id, 'categories');
      const querySnapshot = await getDocs(categoriesRef);
      
      const categoryList = [];
      querySnapshot.forEach((doc) => {
        categoryList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      setCategories(categoryList);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Parse Alipay CSV
  const parseAlipayCSV = (csvText) => {
    const lines = csvText.split('\n');
    let dataStartIndex = -1;
    
    // Find the header line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('交易时间,交易分类')) {
        dataStartIndex = i + 1;
        break;
      }
    }
    
    if (dataStartIndex === -1) {
      throw new Error('Invalid Alipay CSV format: Header not found');
    }

    const transactions = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = line.split(',');
      if (fields.length < 8) continue;

      const [dateTime, category, counterparty, account, description, type, amount, paymentMethod, status] = fields;
      
      // Skip non-transaction records
      if (type !== '支出' && type !== '收入') continue;
      
      transactions.push({
        date: new Date(dateTime),
        type: type === '支出' ? 'expense' : 'income',
        amount: Math.abs(parseFloat(amount)),
        description: description || counterparty,
        category: CATEGORY_MAPPING.alipay[category] || 'Other',
        paymentMethod: paymentMethod,
        platform: 'alipay',
        originalData: {
          category,
          counterparty,
          account,
          status
        }
      });
    }

    return transactions;
  };

  // Parse WeChat Pay CSV
  const parseWeChatCSV = (csvText) => {
    const lines = csvText.split('\n');
    let dataStartIndex = -1;
    
    // Find the header line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('交易时间,交易类型')) {
        dataStartIndex = i + 1;
        break;
      }
    }
    
    if (dataStartIndex === -1) {
      throw new Error('Invalid WeChat Pay CSV format: Header not found');
    }

    const transactions = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const fields = line.split(',');
      if (fields.length < 8) continue;

      const [dateTime, transactionType, counterparty, product, type, amountStr, paymentMethod, status] = fields;
      
      // Skip non-transaction records
      if (type !== '支出' && type !== '收入') continue;
      
      // Parse amount (remove ¥ symbol)
      const amount = Math.abs(parseFloat(amountStr.replace('¥', '')));
      
      transactions.push({
        date: new Date(dateTime),
        type: type === '支出' ? 'expense' : 'income',
        amount,
        description: product || counterparty,
        category: CATEGORY_MAPPING.wechat[transactionType] || 'Other',
        paymentMethod: paymentMethod,
        platform: 'wechat',
        originalData: {
          transactionType,
          counterparty,
          status
        }
      });
    }

    return transactions;
  };

  // Map category name to category ID
  const mapCategoryToId = (categoryName) => {
    const category = categories.find(cat => 
      cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    return category ? category.id : null;
  };

  // Import transactions to Firestore
  const importTransactions = async (transactions) => {
    if (!currentLedger || !canEdit) return;

    const transactionsRef = collection(db, 'ledgers', currentLedger.id, 'transactions');
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      try {
        // Check for duplicates based on date, amount, and description
        const duplicateQuery = query(
          transactionsRef,
          where('date', '==', Timestamp.fromDate(transaction.date)),
          where('amount', '==', transaction.amount),
          where('description', '==', transaction.description)
        );
        
        const duplicateSnapshot = await getDocs(duplicateQuery);
        
        if (!duplicateSnapshot.empty) {
          skipped++;
          continue;
        }

        // Map category
        const categoryId = mapCategoryToId(transaction.category);
        
        // Add transaction
        await addDoc(transactionsRef, {
          date: Timestamp.fromDate(transaction.date),
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          categoryId: categoryId,
          paymentMethod: transaction.paymentMethod,
          includeInBudget: true,
          platform: transaction.platform,
          originalData: transaction.originalData,
          createdAt: new Date(),
          createdBy: currentUser.uid
        });

        imported++;
        setImportProgress(Math.round(((i + 1) / transactions.length) * 100));
      } catch (error) {
        console.error('Error importing transaction:', error);
        skipped++;
      }
    }

    return { imported, skipped, total: transactions.length };
  };

  // Handle file upload and import
  const handleImport = async () => {
    if (!file || !selectedPlatform || !canEdit) return;

    setImporting(true);
    setImportProgress(0);
    setError('');
    setSuccess('');

    try {
      const fileText = await file.text();
      let transactions = [];

      // Parse based on platform
      if (selectedPlatform === 'alipay') {
        // Convert from GB2312 to UTF-8 if needed
        transactions = parseAlipayCSV(fileText);
      } else if (selectedPlatform === 'wechat') {
        transactions = parseWeChatCSV(fileText);
      } else if (selectedPlatform === 'generic') {
        // TODO: Implement LLM-powered parsing
        throw new Error('Generic LLM parser not yet implemented');
      }

      if (transactions.length === 0) {
        throw new Error('No valid transactions found in the file');
      }

      // Import transactions
      const results = await importTransactions(transactions);
      setImportResults(results);
      
      if (results.imported > 0) {
        setSuccess(`Successfully imported ${results.imported} transactions. ${results.skipped} duplicates were skipped.`);
      } else {
        setError('No new transactions were imported. All transactions may be duplicates.');
      }

    } catch (error) {
      console.error('Import error:', error);
      setError(error.message || 'Failed to import transactions');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResults(null);
      setError('');
      setSuccess('');
    }
  };

  // Download sample template
  const downloadSampleTemplate = (platform) => {
    let sampleContent = '';
    let filename = '';

    if (platform === 'alipay') {
      sampleContent = `交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
2025-06-22 00:08:11,日用百货,商家名称,152******49,商品描述,支出,380.00,工商银行储蓄卡(6164),交易成功,订单号,商家订单号,`;
      filename = 'alipay_sample.csv';
    } else if (platform === 'wechat') {
      sampleContent = `交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
2025-06-22 17:34:44,转账,朋友姓名,转账备注:微信转账,收入,¥380.00,/,已存入零钱,交易单号,/,/
2025-06-20 20:32:31,商户消费,美团,先骑后付,支出,¥1.50,零钱,支付成功,交易单号,商户单号,/`;
      filename = 'wechat_sample.csv';
    }

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  useEffect(() => {
    fetchCategories();
  }, [currentLedger]);

  useEffect(() => {
    // Clear messages after 5 seconds
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (!canEdit) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to import data to this ledger.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Import Transactions</h1>
        <Badge variant="secondary" className="text-sm">
          Current Ledger: {currentLedger?.name}
        </Badge>
      </div>

      {/* Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Import Platform</CardTitle>
          <CardDescription>
            Choose the platform you want to import transactions from
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {IMPORT_PLATFORMS.map((platform) => {
              const IconComponent = platform.icon;
              return (
                <div
                  key={platform.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedPlatform === platform.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPlatform(platform.id)}
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <IconComponent className="h-6 w-6 text-blue-600" />
                    <h3 className="font-medium">{platform.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{platform.description}</p>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div>Format: {platform.fileFormat}</div>
                    <div>Encoding: {platform.encoding}</div>
                    <div>Currency: {platform.currency}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSampleTemplate(platform.id);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Sample
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* File Upload */}
      {selectedPlatform && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Transaction File</CardTitle>
            <CardDescription>
              Upload your {IMPORT_PLATFORMS.find(p => p.id === selectedPlatform)?.name} export file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Select File</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.txt,.pdf"
                  onChange={handleFileSelect}
                  disabled={importing}
                />
              </div>

              {file && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                </div>
              )}

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Importing transactions...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="w-full" />
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={!file || importing}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing ? 'Importing...' : 'Import Transactions'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResults && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{importResults.imported}</div>
                <div className="text-sm text-gray-600">Imported</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{importResults.skipped}</div>
                <div className="text-sm text-gray-600">Skipped (Duplicates)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{importResults.total}</div>
                <div className="text-sm text-gray-600">Total Processed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Import Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Alipay (支付宝)</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Open Alipay app → Me → Bill → Export Bill</li>
                <li>Select date range and export as CSV</li>
                <li>Upload the downloaded CSV file</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">WeChat Pay (微信支付)</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Open WeChat → Me → Pay → Wallet → Bill</li>
                <li>Select date range and export as CSV</li>
                <li>Upload the downloaded CSV file</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2">Generic LLM Parser</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Upload any transaction file (CSV, TXT, PDF)</li>
                <li>AI will automatically detect and parse the format</li>
                <li>Review and confirm the parsed transactions</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

