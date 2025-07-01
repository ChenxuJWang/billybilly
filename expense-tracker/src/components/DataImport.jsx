import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import {
  Upload,
  CheckCircle,
  AlertCircle,
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
  Timestamp,
  writeBatch,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';

const IMPORT_PLATFORMS = [
  {
    id: 'alipay',
    name: 'Alipay',
    icon: CreditCard,
    sampleFields: ['交易时间', '交易分类', '交易对方', '商品说明', '收/支', '金额', '支付方式', '当前状态'],
    encoding: 'GB2312',
    currency: 'CNY'
  },
  {
    id: 'wechat',
    name: 'WeChat Pay',
    icon: Smartphone,
    sampleFields: ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态'],
    encoding: 'UTF-8',
    currency: 'CNY'
  },
  {
    id: 'llm',
    name: 'Generic (AI Powered)',
    icon: Bot,
    sampleFields: ['Any CSV, TXT, or PDF file'],
    encoding: 'Auto-detect',
    currency: 'Auto-detect'
  }
];

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
    const lines = csvText.split("\n");
    let dataStartIndex = -1;
    
    // Find the header line - be more flexible with header detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("交易时间") && (line.includes("交易分类") || line.includes("收/支"))) {
        dataStartIndex = i + 1;
        break;
      }
    }
    
    if (dataStartIndex === -1) {
      // Try alternative approach - look for lines with transaction data pattern
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
          dataStartIndex = i;
          break;
        }
      }
    }
    
    if (dataStartIndex === -1) {
      throw new Error("Invalid Alipay CSV format: No transaction data found. Please ensure the file contains transaction records.");
    }

    const transactions = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // More robust CSV parsing - handle quoted fields
      const fields = line.split(",").map(field => field.replace(/^"|"$/g, "").trim());
      if (fields.length < 6) continue;

      // Handle different CSV formats
      let dateTime, category, counterparty, account, description, type, amount, paymentMethod, status;
      
      if (fields.length >= 12) {
        // Standard Alipay format
        [dateTime, category, counterparty, account, description, type, amount, paymentMethod, status] = fields;
      } else if (fields.length >= 8) {
        // Simplified format
        [dateTime, category, counterparty, description, type, amount, paymentMethod, status] = fields;
        account = "";
      } else {
        continue; // Skip invalid lines
      }
      
      // Skip non-transaction records
      if (!type || (type !== "支出" && type !== "收入")) continue;
      
      // Parse amount - handle different formats
      const amountStr = amount.toString().replace(/[^\d.-]/g, "");
      const parsedAmount = parseFloat(amountStr);
      if (isNaN(parsedAmount)) continue;

      // Map to existing categories or use original category name
      const mappedCategory = categories.find(cat => 
        cat.name.toLowerCase().includes(category.toLowerCase()) ||
        category.toLowerCase().includes(cat.name.toLowerCase())
      );
      
      // Create notes with counterparty information for Alipay
      const notes = counterparty ? `Counterparty: ${counterparty}` : '';
      
      transactions.push({
        date: new Date(dateTime),
        type: type === "支出" ? "expense" : "income",
        amount: Math.abs(parsedAmount),
        description: description || "Unknown Transaction",
        notes: notes,
        categoryId: mappedCategory ? mappedCategory.id : null,
        categoryName: mappedCategory ? mappedCategory.name : category,
        paymentMethod: paymentMethod || "Unknown",
        platform: "alipay",
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
    const lines = csvText.split("\n");
    let dataStartIndex = -1;

    // Find the header line - be more flexible with header detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("交易时间") && (line.includes("交易类型") || line.includes("收/支"))) {
        dataStartIndex = i + 1;
        break;
      }
    }

    if (dataStartIndex === -1) {
      // Try alternative approach - look for lines with transaction data pattern
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
          dataStartIndex = i;
          break;
        }
      }
    }

    if (dataStartIndex === -1) {
      throw new Error("Invalid WeChat Pay CSV format: No transaction data found. Please ensure the file contains transaction records.");
    }

    const transactions = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // More robust CSV parsing - handle quoted fields
      const fields = line.split(",").map(field => field.replace(/^"|"$/g, "").trim());
      if (fields.length < 6) continue;

      // Handle different CSV formats
      let dateTime, transactionType, counterparty, product, type, amountStr, paymentMethod, status;
      
      if (fields.length >= 11) {
        // Standard WeChat Pay format
        [dateTime, transactionType, counterparty, product, type, amountStr, paymentMethod, status] = fields;
      } else if (fields.length >= 8) {
        // Simplified format
        [dateTime, transactionType, counterparty, product, type, amountStr, paymentMethod, status] = fields;
      } else {
        continue; // Skip invalid lines
      }
      
      // Skip non-transaction records
      if (!type || (type !== "支出" && type !== "收入")) continue;
      
      // Parse amount - handle different formats (remove ¥ symbol and other characters)
      const cleanAmountStr = amountStr.toString().replace(/[¥￥,\s]/g, "").replace(/[^\d.-]/g, "");
      const parsedAmount = parseFloat(cleanAmountStr);
      if (isNaN(parsedAmount)) continue;
      
      // Map to existing categories or use original category name
      const mappedCategory = categories.find(cat => 
        cat.name.toLowerCase().includes(transactionType.toLowerCase()) ||
        transactionType.toLowerCase().includes(cat.name.toLowerCase())
      );
      
      // Create notes with counterparty information for WeChat Pay
      const notes = counterparty ? `Counterparty: ${counterparty}` : '';
      
      transactions.push({
        date: new Date(dateTime),
        type: type === "支出" ? "expense" : "income",
        amount: Math.abs(parsedAmount),
        description: product || "Unknown Transaction",
        notes: notes,
        categoryId: mappedCategory ? mappedCategory.id : null,
        categoryName: mappedCategory ? mappedCategory.name : transactionType,
        paymentMethod: paymentMethod || "Unknown",
        platform: "wechat",
        originalData: {
          transactionType,
          counterparty,
          status
        }
      });
    }

    return transactions;
  };

  // Import transactions to Firestore using batch writes for better performance
  const importTransactions = async (transactions) => {
    if (!currentLedger || !canEdit()) return;

    const transactionsRef = collection(db, 'ledgers', currentLedger.id, 'transactions');
    let imported = 0;
    let skipped = 0;

    // First, fetch existing transactions to check for duplicates
    const existingTransactionsQuery = query(transactionsRef);
    const existingSnapshot = await getDocs(existingTransactionsQuery);
    const existingTransactions = new Set();
    
    existingSnapshot.forEach((doc) => {
      const data = doc.data();
      // Create a unique key for duplicate detection
      const key = `${data.date?.toDate()?.toISOString()}-${data.amount}-${data.description}`;
      existingTransactions.add(key);
    });

    // Process transactions in batches of 500 (Firestore batch limit)
    const BATCH_SIZE = 500;
    const batches = [];
    
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchTransactions = transactions.slice(i, i + BATCH_SIZE);
      let batchImported = 0;
      let batchSkipped = 0;

      for (const transaction of batchTransactions) {
        // Check for duplicates
        const duplicateKey = `${transaction.date.toISOString()}-${transaction.amount}-${transaction.description}`;
        
        if (existingTransactions.has(duplicateKey)) {
          batchSkipped++;
          continue;
        }

        // Add to batch
        const newDocRef = doc(transactionsRef);
        batch.set(newDocRef, {
          date: Timestamp.fromDate(transaction.date),
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          notes: transaction.notes || '',
          categoryId: transaction.categoryId,
          categoryName: transaction.categoryName,
          paymentMethod: transaction.paymentMethod,
          includeInBudget: true,
          platform: transaction.platform,
          originalData: transaction.originalData,
          createdAt: new Date(),
          createdBy: currentUser.uid,
          paidBy: currentUser.uid
        });

        batchImported++;
        // Add to existing set to prevent duplicates within the same import
        existingTransactions.add(duplicateKey);
      }

      if (batchImported > 0) {
        batches.push({ batch, imported: batchImported, skipped: batchSkipped });
      } else {
        skipped += batchSkipped;
      }
    }

    // Execute all batches
    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].batch.commit();
        imported += batches[i].imported;
        skipped += batches[i].skipped;
        
        // Update progress
        const progress = Math.round(((i + 1) / batches.length) * 100);
        setImportProgress(progress);
      } catch (error) {
        console.error('Error committing batch:', error);
        skipped += batches[i].imported; // Count failed imports as skipped
      }
    }

    setImportResults({ imported, skipped });
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setImporting(true);
    setImportProgress(0);
    setImportResults(null);
    setError("");
    setSuccess("");

    try {
      let parsedTransactions = [];
      
      if (selectedPlatform === "alipay") {
        // Alipay CSVs are often GB2312 encoded
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const decoder = new TextDecoder("gb2312");
        const decodedText = decoder.decode(arrayBuffer);
        parsedTransactions = parseAlipayCSV(decodedText);
      } else if (selectedPlatform === "wechat") {
        const text = await uploadedFile.text();
        parsedTransactions = parseWeChatCSV(text);
      } else if (selectedPlatform === "llm") {
        // Placeholder for LLM parsing
        throw new Error("LLM parsing not yet implemented.");
      }

      if (parsedTransactions.length === 0) {
        throw new Error("No valid transactions found in the file.");
      }

      await importTransactions(parsedTransactions);
      setSuccess(`Successfully imported ${importResults?.imported || 0} transactions!`);
    } catch (err) {
      console.error("Import error:", err);
      setError(`Import error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [currentLedger]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  if (!currentLedger) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select a ledger to manage categories.
      </div>
    );
  }

  if (importing) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Importing Transactions...</h1>
        <Progress value={importProgress} className="w-full" />
        <p className="text-center text-gray-600">{importProgress}% Complete</p>
      </div>
    );
  }

  if (importResults) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Import Complete!</h1>
        <Alert variant="default">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Successfully imported {importResults.imported} transactions.
            {importResults.skipped > 0 && ` ${importResults.skipped} transactions skipped (duplicates or errors).`}
          </AlertDescription>
        </Alert>
        <Button onClick={() => setImportResults(null)}>Import More</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Import Transactions</h1>

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

      <Card>
        <CardHeader>
          <CardTitle>Select Import Platform</CardTitle>
          <CardDescription>Choose the platform you want to import transactions from.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select a platform" />
            </SelectTrigger>
            <SelectContent>
              {IMPORT_PLATFORMS.map((platform) => (
                <SelectItem key={platform.id} value={platform.id}>
                  <div className="flex items-center space-x-2">
                    <platform.icon className="h-4 w-4" />
                    <span>{platform.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPlatform && (
        <Card>
          <CardHeader>
            <CardTitle>Upload {IMPORT_PLATFORMS.find(p => p.id === selectedPlatform)?.name} File</CardTitle>
            <CardDescription>
              Upload your exported {IMPORT_PLATFORMS.find(p => p.id === selectedPlatform)?.name} CSV file.
              Ensure it's the correct format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="file-upload" className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                <Upload className="h-4 w-4 inline-block mr-2" /> Choose File
              </Label>
              <Input
                id="file-upload"
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept=".csv,.txt"
              />
              {file && <Badge variant="secondary">{file.name}</Badge>}
            </div>
            <div className="text-sm text-gray-500">
              <p>Expected fields for {IMPORT_PLATFORMS.find(p => p.id === selectedPlatform)?.name}:</p>
              <ol className="list-decimal list-inside">
                {IMPORT_PLATFORMS.find(p => p.id === selectedPlatform)?.sampleFields.map((field, index) => (
                  <li key={index}>{field}</li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

