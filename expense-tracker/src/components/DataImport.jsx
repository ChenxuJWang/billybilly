import React, { useState, useEffect, useRef } from 'react';
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
  Bot,
  XCircle,
  Edit
} from 'lucide-react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLedger } from '../contexts/LedgerContext';
import { callLLMCategorization } from '../utils/llmCategorization';

function normalize(str) {
  return (str || '').trim().toLowerCase();
}

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

export default function DataImport({ debugModeEnabled, thinkingModeEnabled }) {
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
  
  // Smart categorization state
  const [smartCategorizationEnabled, setSmartCategorizationEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [parsedTransactions, setParsedTransactions] = useState([]);
  const [displayedTransactions, setDisplayedTransactions] = useState([]);
  const [llmProcessing, setLlmProcessing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [reviewingTransactions, setReviewingTransactions] = useState(false); // New state for review stage
  const abortControllerRef = useRef(null); // For canceling LLM process

  // Transaction refs for scrolling 
  const transactionRefs = useRef({});
  const [lastUpdatedId, setLastUpdatedId] = useState(null);

  // Scroll to last updated transaction when lastUpdatedId changes
  useEffect(() => {
    if (lastUpdatedId && transactionRefs.current[lastUpdatedId]) {
      transactionRefs.current[lastUpdatedId].current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [lastUpdatedId]);

  // Detect when a transaction's llmCategory is set/changed
  useEffect(() => {
    if (!llmProcessing) return;
    let lastChangedId = null;
    displayedTransactions.forEach((transaction, idx) => {
      // Only scroll if llmCategory is set for the first time or changed
      if (
        transaction.llmCategory &&
        (!transactionRefs.current._prevLlmCategories ||
          transactionRefs.current._prevLlmCategories[transaction.id] !== transaction.llmCategory)
      ) {
        lastChangedId = transaction.id;
      }
    });
    // Save current llmCategories for next comparison
    transactionRefs.current._prevLlmCategories = Object.fromEntries(
      displayedTransactions.map(t => [t.id, t.llmCategory])
    );
    if (lastChangedId) setLastUpdatedId(lastChangedId);
  }, [displayedTransactions, llmProcessing]);

  // Load smart categorization settings
  const loadSmartCategorizationSettings = async () => {
    if (!currentUser) return;

    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        setSmartCategorizationEnabled(userData.smartCategorizationEnabled || false);
        setApiKey(userData.llmApiKey || '');
        
        // Generate system prompt with current ledger categories
        if (currentLedger && categories.length > 0) {
          const expenseCategories = categories.filter(cat => cat.type === 'expense');
          const incomeCategories = categories.filter(cat => cat.type === 'income');
          
          const prompt = `You are a financial-data assistant. I will provide you with a CSV file of transactions containing at least the following columns: Date, Description, Amount.  Response in JSON and say nothing else:\n\n1. For each row, determine whether it is an **expense** or an **income**.   \n\n2. Assign each transaction to one of the following **Expense** or **Income** categories (or to a special category if needed):\n\n   **Expense Categories**  \n   ${expenseCategories.map(cat => `- ${cat.name}`).join("\\n") || "- HTT: (Hard To Tell) if you can't unambiguously assign one of the above"}\n\n   **Income Categories**  \n   ${incomeCategories.map(cat => `- ${cat.name}`).join("\\n") || "- HTT"}\n\n   Use merchant names, keywords in the description, or amount signs to guide your choice.  \n\n3. Output a single JSON object with this exact structure:\n\n{\n  "transactions": [\n    {\n      "id": "<self-increment id>",\n      "category": "<one of the given categories: ${[...expenseCategories, ...incomeCategories].map(cat => cat.name).join(", ")}, HTT>"\n    }\n  ]\n}\n
4.  Optionally, "corrections" showing prior mis-classifications I've corrected may be provided to guide this categorization `;
          
          setSystemPrompt(prompt);
        }
      }
    } catch (error) {
      console.error("Error loading smart categorization settings:", error);
    }
  };

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

  // Helper function to parse CSV line considering quoted fields
  const parseCSVLine = (line) => {
    const fields = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim()); // Add the last field
    return fields.map(field => field.replace(/^"|"$/g, '')); // Remove surrounding quotes
  };

  // Parse Alipay CSV
  const parseAlipayCSV = (csvText) => {
    const lines = csvText.split("\n");
    let dataStartIndex = -1;
    
    // Find the header line - be more flexible with header detection
    // Look for a line containing "交易时间" and "交易分类" or "收/支"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("交易时间") && (line.includes("交易分类") || line.includes("收/支"))) {
        dataStartIndex = i + 1;
        break;
      }
    }
    
    // If header not found by keywords, try to find the first line that looks like a transaction
    if (dataStartIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Check for a typical date-time pattern at the beginning of the line
        if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
          dataStartIndex = i;
          break;
        }
      }
    }

    // If still not found, assume data starts after 23 lines as a last resort (based on llm-cat context)
    if (dataStartIndex === -1) {
      dataStartIndex = 23; 
    }

    const transactions = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // More robust CSV parsing - handle quoted fields
      const fields = parseCSVLine(line);
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
      
      // Classify non-"支出" and non-"收入" as "income"
      const transactionType = (type === "支出") ? "expense" : "income";
      
      // Parse amount - handle different formats
      const amountStr = amount.toString().replace(/[^\d.-]/g, "");
      const parsedAmount = parseFloat(amountStr);
      if (isNaN(parsedAmount)) continue;

      // Map to existing categories or use original category name
      const mappedCategory = categories.find(cat => 
        normalize(cat.name).includes(normalize(category)) ||
        normalize(category).includes(normalize(cat.name))
      );
      
      // Create notes with counterparty information for Alipay
      const notes = counterparty ? `Counterparty: ${counterparty}` : '';
      
      transactions.push({
        id: i - dataStartIndex + 1, // Self-incrementing ID starting from 1
        date: new Date(dateTime),
        type: transactionType,
        amount: Math.abs(parsedAmount),
        description: description || "Unknown Transaction",
        notes: notes,
        counterparty: counterparty || '', // Add counterparty
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
    // Look for a line containing "交易时间" and "交易类型" or "收/支"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("交易时间") && (line.includes("交易类型") || line.includes("收/支"))) {
        dataStartIndex = i + 1;
        break;
      }
    }

    // If header not found by keywords, try to find the first line that looks like a transaction
    if (dataStartIndex === -1) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Check for a typical date-time pattern at the beginning of the line
        if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
          dataStartIndex = i;
          break;
        }
      }
    }

    // If still not found, assume data starts after 15 lines as a last resort (based on llm-cat context)
    if (dataStartIndex === -1) {
      dataStartIndex = 15;
    }

    const transactions = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // More robust CSV parsing - handle quoted fields
      const fields = parseCSVLine(line);
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
      
      // Classify non-"支出" and non-"收入" as "income"
      const transactionTypeMapped = (type === "支出") ? "expense" : "income";
      
      // Parse amount - handle different formats (remove ¥ symbol and other characters)
      const cleanAmountStr = amountStr.toString().replace(/[¥￥,\s]/g, "").replace(/[^\d.-]/g, "");
      const parsedAmount = parseFloat(cleanAmountStr);
      if (isNaN(parsedAmount)) continue;
      
      // Map to existing categories or use original category name
      const mappedCategory = categories.find(cat => 
        normalize(cat.name).includes(normalize(transactionType)) ||
        normalize(transactionType).includes(normalize(cat.name))
      );
      
      // Create notes with counterparty information for WeChat Pay
      const notes = counterparty ? `Counterparty: ${counterparty}` : '';
      
      transactions.push({
        id: i - dataStartIndex + 1, // Self-incrementing ID starting from 1
        date: new Date(dateTime),
        type: transactionTypeMapped,
        amount: Math.abs(parsedAmount),
        description: product || "Unknown Transaction",
        notes: notes,
        counterparty: counterparty || '', // Add counterparty
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

  // Update partial results in real-time
  const updatePartialResults = (validatedData) => {
    setDisplayedTransactions(prevTransactions => 
      prevTransactions.map((transaction) => {
        const apiResult = validatedData.transactions.find(t => 
          parseInt(t.id) === transaction.id
        );
        
        if (apiResult) {
          const category = apiResult.category || 'HTT';
          return {
            ...transaction,
            llmCategory: category,
            llmProcessing: false
          };
        }
        
        return transaction;
      })
    );
  };

  // Process LLM categorization
  const processLLMCategorization = async (transactions) => {
    try {
      setStreamingContent('');
      
      const onStreamUpdate = (content) => {
        setStreamingContent(content);
      };

      const onPartialResults = (data) => {
        updatePartialResults(data);
      };

      const finalResults = await callLLMCategorization(
        transactions,
        systemPrompt,
        apiKey,
        onStreamUpdate,
        onPartialResults,
        abortControllerRef.current?.signal,
        thinkingModeEnabled || false
      );

      // Update final results
      updatePartialResults(finalResults);

      // Update transactions with LLM categories and prepare for review
      const transactionsWithLLMCategories = transactions.map((transaction) => {
        const apiResult = finalResults.transactions.find(t => 
          parseInt(t.id) === transaction.id
        );
        
        if (apiResult) {
          const llmCategoryName = apiResult.category || 'HTT';
          // Try to find matching category in the ledger using normalize
          const matchedCategory = categories.find(cat => 
            normalize(cat.name) === normalize(llmCategoryName)
          );
          
          return {
            ...transaction,
            categoryId: matchedCategory ? matchedCategory.id : null,
            categoryName: matchedCategory ? matchedCategory.name : llmCategoryName,
            llmCategory: llmCategoryName, // Store LLM suggested category for display
            llmProcessing: false // Mark as processed
          };
        }
        
        return transaction;
      });

      setDisplayedTransactions(transactionsWithLLMCategories); // Update displayed transactions with LLM results
      setReviewingTransactions(true); // Enter review stage
      
    } catch (error) {
      if (error.name === 'AbortError') {
        setError('LLM categorization was cancelled.');
      } else {
        console.error('LLM categorization error:', error);
        setError(`LLM categorization failed: ${error.message}`);
        // Fallback to normal import without LLM categories
        await importTransactions(transactions);
      }
    } finally {
      setLlmProcessing(false);
      setImporting(false);
    }
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
    setReviewingTransactions(false); // Reset review state
    abortControllerRef.current = new AbortController(); // Initialize AbortController

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

      // Store parsed transactions for potential LLM processing
      setParsedTransactions(parsedTransactions);
      
      // Display transactions immediately
      setDisplayedTransactions(parsedTransactions.map(t => ({
        ...t,
        llmCategory: null,
        llmProcessing: true
      })));

      // Check if smart categorization is enabled and API key is available
      if (smartCategorizationEnabled && apiKey && (selectedPlatform === 'alipay' || selectedPlatform === 'wechat')) {
        setLlmProcessing(true);
        // Trigger LLM categorization process
        await processLLMCategorization(parsedTransactions);
      } else {
        // Proceed with normal import
        await importTransactions(parsedTransactions);
        setSuccess(`Successfully imported ${importResults?.imported || 0} transactions!`);
        setImporting(false);
      }
    } catch (err) {
      console.error("Import error:", err);
      setError(`Import error: ${err.message}`);
      setImporting(false);
      setLlmProcessing(false);
    }
  };

  const handleCancelLlmProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Signal to cancel the ongoing fetch/LLM process
      console.log('LLM processing cancelled.');
      setLlmProcessing(false);
      setImporting(false);
      setError('LLM categorization cancelled by user.');
      setReviewingTransactions(false); // Exit review state if cancelled during processing
    }
  };

  const handleConfirmImport = async () => {
    setImporting(true); // Re-enable importing state for progress display
    setReviewingTransactions(false); // Exit review state
    setError('');
    setSuccess('');
    try {
      await importTransactions(displayedTransactions); // Import the reviewed/edited transactions
      setSuccess(`Successfully imported ${importResults?.imported || 0} transactions with AI categorization!`);
    } catch (err) {
      console.error('Error confirming import:', err);
      setError(`Import confirmation failed: ${err.message}`);
    }
  };

  const handleCancelReview = () => {
    setReviewingTransactions(false);
    setImporting(false);
    setDisplayedTransactions([]);
    setParsedTransactions([]);
    setFile(null);
    setError('');
    setSuccess('Import cancelled.');
  };

  const handleCategoryChange = (transactionId, newCategoryId) => {
    setDisplayedTransactions(prevTransactions =>
      prevTransactions.map(transaction =>
        transaction.id === transactionId
          ? { 
              ...transaction, 
              categoryId: newCategoryId === 'uncategorized' ? null : newCategoryId, 
              categoryName: newCategoryId === 'uncategorized' ? 'Uncategorized' : (categories.find(cat => cat.id === newCategoryId)?.name || 'HTT')
            }
          : transaction
      )
    );
  };

  useEffect(() => {
    fetchCategories();
  }, [currentLedger]);

  useEffect(() => {
    if (categories.length > 0) {
      loadSmartCategorizationSettings();
    }
  }, [currentUser, currentLedger, categories]);

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
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {llmProcessing ? 'Processing with Smart Categorization...' : 'Importing Transactions...'}
          </h1>
          {llmProcessing && (
            <Button variant="outline" onClick={handleCancelLlmProcessing} className="flex items-center space-x-2">
              <XCircle className="h-4 w-4" />
              <span>Cancel</span>
            </Button>
          )}
        </div>
        
        {/* Display transactions immediately */}
        {displayedTransactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Imported Transactions</CardTitle>
              <CardDescription>
                {llmProcessing ? 'AI is categorizing transactions...' : 'Processing transactions...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {displayedTransactions.map((transaction, index) => {
                  if (!transactionRefs.current[transaction.id]) {
                    transactionRefs.current[transaction.id] = React.createRef();
                  }
                  return (
                    <div
                      key={transaction.id}
                      ref={transactionRefs.current[transaction.id]}
                      className="flex justify-between items-center p-2 border rounded"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-gray-500">
                          {transaction.date.toLocaleString()} • {transaction.amount} CNY
                          {transaction.counterparty && ` • ${transaction.counterparty}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={transaction.type === 'expense' ? 'destructive' : 'default'}>
                          {transaction.type}
                        </Badge>
                        {llmProcessing && (
                          <div className="text-sm text-gray-500 mt-1">
                            {transaction.llmCategory || 'Processing...'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Show streaming content when LLM is processing */}
        {llmProcessing && debugModeEnabled && streamingContent && (
          <Card>
            <CardHeader>
              <CardTitle>AI Response Stream</CardTitle>
              <CardDescription>Real-time categorization response from AI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 p-3 rounded text-sm font-mono max-h-40 overflow-y-auto">
                {streamingContent}
              </div>
            </CardContent>
          </Card>
        )}
        
        {!llmProcessing && (
          <>
            <Progress value={importProgress} className="w-full" />
            <p className="text-center text-gray-600">{importProgress}% Complete</p>
          </>
        )}
      </div>
    );
  }

  if (reviewingTransactions) {
    const expenseCategories = categories.filter(cat => cat.type === 'expense');
    const incomeCategories = categories.filter(cat => cat.type === 'income');

    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Review Categorization</h1>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleCancelReview} className="flex items-center space-x-2">
              <XCircle className="h-4 w-4" />
              <span>Cancel</span>
            </Button>
            <Button onClick={handleConfirmImport} className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Confirm Import</span>
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Categorized Transactions</CardTitle>
            <CardDescription>Review and adjust the AI-suggested categories.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {displayedTransactions.map((transaction, index) => (
                <div key={index} className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 border rounded-lg shadow-sm">
                  <div className="flex-1 mb-2 md:mb-0">
                    <div className="font-medium text-lg">{transaction.description}</div>
                    <div className="text-sm text-gray-600">
                      {transaction.date.toLocaleString()} • {transaction.amount} CNY
                      {transaction.counterparty && ` • ${transaction.counterparty}`}
                    </div>
                    <Badge variant={transaction.type === 'expense' ? 'destructive' : 'default'}>
                      {transaction.type}
                    </Badge>
                  </div>
                  <div className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
                    <div className="text-sm text-gray-700">
                      AI Suggestion: <span className="font-semibold">{transaction.llmCategory || 'N/A'}</span>
                    </div>
                    <Select
                      value={transaction.categoryId && categories.find(cat => cat.id === transaction.categoryId) ? transaction.categoryId : 'uncategorized'}
                      onValueChange={(newCategoryId) => handleCategoryChange(transaction.id, newCategoryId)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uncategorized">Uncategorized</SelectItem>
                        {transaction.type === 'expense' && expenseCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                        {transaction.type === 'income' && incomeCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {debugModeEnabled && streamingContent && (
          <Card>
            <CardHeader>
              <CardTitle>AI Response Stream (Debug)</CardTitle>
              <CardDescription>Raw streaming response from AI during categorization.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-100 p-3 rounded text-sm font-mono max-h-40 overflow-y-auto">
                {streamingContent}
              </div>
            </CardContent>
          </Card>
        )}
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

      {/* Smart Categorization Status */}
      {smartCategorizationEnabled && (
        <Alert>
          <Bot className="h-4 w-4" />
          <AlertDescription>
            Smart Categorization is enabled. Transactions will be automatically categorized using AI.
          </AlertDescription>
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



