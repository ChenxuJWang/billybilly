import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Alert, AlertDescription } from '@/components/ui/alert.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Upload, Download, Play, CheckCircle, XCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'
import './App.css'

// Zod schema for transaction categorization response
const TransactionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  Id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  category: z.string().optional(),
  cat: z.string().optional()
}).transform(data => ({
  id: data.id || data.Id || '',
  category: data.category || data.cat || ''
}))

const ResponseSchema = z.object({
  transactions: z.array(TransactionSchema)
})

function App() {
  const [apiKey, setApiKey] = useState('')
  const [apiKeyConfirmed, setApiKeyConfirmed] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(`You are a financial-data assistant. I will provide you with a CSV file of transactions containing at least the following columns: Date, Description, Amount.  Response in JSON and say nothing else:

1. For each row, determine whether it is an **expense** or an **income**.   

2. Assign each transaction to one of the following **Expense** or **Income** categories (or to a special category if needed):

   **Expense Categories**  
   - Bills & Utilities  
   - Entertainment  
   - Food & Dining  
   - Healthcare  
   - Shopping  
   - Transportation  
- HTT:(Hard To Tell) if you can't unambiguously assign one of the above 

   **Income Categories**  
   - Salary  
   - Freelance  
   - Investment  
- HTT
- Refund

   Use merchant names, keywords in the description, or amount signs to guide your choice.  

3. Output a single JSON object with this exact structure:

\`\`\`json
{
  "transactions": [
    {
"Id": "<self-increment id>",
      "category": "<one of the given categories: Bills & Utilities, …, Refund, HTT>"
    }
  ]
}

4.  Optionally, "corrections" showing prior mis-classifications I've corrected may be provided to guide this categorization `)
  const [systemPromptConfirmed, setSystemPromptConfirmed] = useState(false)
  const [optionalMessage, setOptionalMessage] = useState('')
  const [transactionData, setTransactionData] = useState([])
  const [validationData, setValidationData] = useState([])
  const [results, setResults] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  
  // New streaming state variables
  const [streamingContent, setStreamingContent] = useState('')
  const [showStreamingPanel, setShowStreamingPanel] = useState(false)
  const [streamingStatus, setStreamingStatus] = useState('idle') // 'idle', 'streaming', 'parsing', 'complete', 'error'
  const [partialResults, setPartialResults] = useState([])

  // Helper function to try parsing JSON with Zod validation
  const tryParseStreamingJSON = (content) => {
    try {
      // Clean up the content - remove markdown code blocks
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      // Try to parse as JSON
      const parsed = JSON.parse(cleanContent)
      
      // Validate with Zod
      const validated = ResponseSchema.parse(parsed)
      
      return { success: true, data: validated }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Update partial results in real-time
  const updatePartialResults = (validatedData) => {
    const updatedResults = transactionData.map((transaction, index) => {
      const apiResult = validatedData.transactions.find(t => 
        parseInt(t.id) === transaction.id
      )
      
      if (apiResult) {
        const category = apiResult.category || apiResult.cat || 'HTT'
        const expectedCategory = validationData[index] || ''
        const isCorrect = expectedCategory ? category === expectedCategory : null

        return {
          ...transaction,
          category,
          isCorrect,
          expectedCategory
        }
      }
      
      return transaction
    })
    
    setPartialResults(updatedResults)
  }

  const handleApiKeyConfirm = () => {
    if (apiKey.trim()) {
      setApiKeyConfirmed(true)
      setError('')
    } else {
      setError('Please enter a valid API key')
    }
  }

  const handleSystemPromptConfirm = () => {
    if (systemPrompt.trim()) {
      setSystemPromptConfirmed(true)
      setError('')
    } else {
      setError('Please enter a system prompt')
    }
  }

  const loadSampleData = async (type) => {
    try {
      let transactionFile, validationFile
      if (type === 'alipay') {
        transactionFile = 'TransactionTest1.csv'
        validationFile = 'test1validation.csv'
      } else {
        transactionFile = 'Transactiontest2.csv'
        validationFile = 'test2validation.csv'
      }

      const [transactionResponse, validationResponse] = await Promise.all([
        fetch(`/${transactionFile}`),
        fetch(`/${validationFile}`)
      ])

      const transactionText = await transactionResponse.text()
      const validationText = await validationResponse.text()

      // Parse transaction data - skip title row (0) and header row (1), start from row 2
      const transactionLines = transactionText.split('\n').filter(line => line.trim())
      const transactions = []

      // Start from index 2 to skip title and header rows
      for (let i = 2; i < transactionLines.length; i++) {
        const values = transactionLines[i].split(',')
        if (values.length >= 3) {
          transactions.push({
            id: i - 1, // Adjust ID to start from 1
            time: values[0] || '',
            description: values[4] || values[3] || values[1] || '', // Use 商品说明 for Alipay, 商品 for WeChat
            amount: values[6] || values[5] || '',
            counterparty: values[2] || ''
          })
        }
      }

      // Parse validation data - skip any header if present
      const validationLines = validationText.split('\n').filter(line => line.trim())
      const validation = validationLines.map(line => line.split(',')[0].trim()).filter(cat => cat && !cat.includes('Expected'))

      setTransactionData(transactions)
      setValidationData(validation)
      setError('')
      
      // Verify data consistency
      if (transactions.length !== validation.length) {
        setError(`Warning: Transaction count (${transactions.length}) doesn't match validation count (${validation.length})`)
      }
    } catch (err) {
      setError(`Failed to load sample data: ${err.message}`)
    }
  }

  const handleFileUpload = (event, type) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const lines = text.split('\n').filter(line => line.trim())

      if (type === 'transaction') {
        const transactions = []
        // Skip title and header rows, start from index 2
        for (let i = 2; i < lines.length; i++) {
          const values = lines[i].split(',')
          if (values.length >= 3) {
            transactions.push({
              id: i - 1, // Adjust ID to start from 1
              time: values[0] || '',
              description: values[4] || values[3] || values[1] || '', // Use 商品说明 for Alipay, 商品 for WeChat
              amount: values[6] || values[5] || '',
              counterparty: values[2] || ''
            })
          }
        }
        setTransactionData(transactions)
      } else {
        // Parse validation data - skip any header if present
        const validation = lines.map(line => line.split(',')[0].trim()).filter(cat => cat && !cat.includes('Expected'))
        setValidationData(validation)
      }
    }
    reader.readAsText(file)
  }

  const generateCategorization = async () => {
    if (!transactionData.length) {
      setError('Please upload transaction data first')
      return
    }

    setIsProcessing(true)
    setError('')
    setResults([])
    setPartialResults([])
    setStreamingContent('')
    setStreamingStatus('streaming')
    setShowStreamingPanel(true)

    try {
      // Prepare CSV data for the API
      const csvHeaders = "Date,Description,Amount,Counterparty"
      const csvData = csvHeaders + "\n" + transactionData.map(t => 
        `"${t.time}","${t.description}","${t.amount}","${t.counterparty}"`
      ).join('\n')

      const userMessage = optionalMessage || "Please categorize the following transactions:"
      const fullUserMessage = `${userMessage}\n\nCSV Data:\n${csvData}`

      const requestBody = {
        messages: [
          {
            content: fullUserMessage,
            role: "user"
          },
          {
            content: systemPrompt,
            role: "system"
          }
        ],
        model: "doubao-seed-1-6-flash-250615",
        stream: true
      }

      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                const newContent = parsed.choices[0].delta.content
                fullContent += newContent
                
                // Update streaming content display
                setStreamingContent(fullContent)
                
                // Try to parse and validate the current content
                const parseResult = tryParseStreamingJSON(fullContent)
                if (parseResult.success) {
                  setStreamingStatus('parsing')
                  updatePartialResults(parseResult.data)
                }
              }
            } catch (e) {
              // Ignore parsing errors for streaming data
              console.warn('Failed to parse streaming data:', e)
            }
          }
        }
      }

      // Final parsing and validation
      setStreamingStatus('parsing')
      const finalParseResult = tryParseStreamingJSON(fullContent)
      
      if (finalParseResult.success) {
        // Map the results to our transaction data
        const resultsWithValidation = transactionData.map((transaction, index) => {
          const apiResult = finalParseResult.data.transactions.find(t => 
            parseInt(t.id) === transaction.id
          )
          
          const category = apiResult ? (apiResult.category || apiResult.cat) : 'HTT'
          const expectedCategory = validationData[index] || ''
          const isCorrect = expectedCategory ? category === expectedCategory : null

          return {
            ...transaction,
            category,
            isCorrect,
            expectedCategory
          }
        })

        setResults(resultsWithValidation)
        setStreamingStatus('complete')
      } else {
        throw new Error(`Failed to parse final response: ${finalParseResult.error}`)
      }
    } catch (err) {
      console.error('API call failed:', err)
      setError(`Failed to generate categorization: ${err.message}`)
      setStreamingStatus('error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">LLM Transaction Categorization Demo</h1>
      
      {error && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: API Key */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 1: API Key Configuration</CardTitle>
          <CardDescription>Enter your Doubao API key</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Enter your Doubao API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={apiKeyConfirmed}
            />
            <Button 
              onClick={handleApiKeyConfirm}
              disabled={apiKeyConfirmed}
            >
              {apiKeyConfirmed ? <CheckCircle className="h-4 w-4" /> : 'Confirm'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: System Prompt */}
      {apiKeyConfirmed && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 2: System Prompt</CardTitle>
            <CardDescription>Configure the system prompt for categorization</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Enter system prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={systemPromptConfirmed}
              rows={10}
              className="mb-2"
            />
            <Button 
              onClick={handleSystemPromptConfirm}
              disabled={systemPromptConfirmed}
            >
              {systemPromptConfirmed ? <CheckCircle className="h-4 w-4" /> : 'Confirm'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Data Upload */}
      {systemPromptConfirmed && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 3: Upload Transaction Data</CardTitle>
            <CardDescription>Upload CSV files or use sample data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Transaction Data CSV</label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'transaction')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Validation Data CSV</label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, 'validation')}
                />
              </div>
            </div>
            
            <div className="flex gap-2 mb-4">
              <Button onClick={() => loadSampleData('alipay')} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Load Alipay Sample
              </Button>
              <Button onClick={() => loadSampleData('wechat')} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Load WeChat Sample
              </Button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Optional Message</label>
              <Input
                placeholder="Enter optional message for the LLM"
                value={optionalMessage}
                onChange={(e) => setOptionalMessage(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction List */}
      {transactionData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Transaction Data ({transactionData.length} transactions)</CardTitle>
              {(streamingContent || results.length > 0) && !showStreamingPanel && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStreamingPanel(true)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Show Streaming
                </Button>
              )}
            </div>
            {results.length > 0 && (
              <CardDescription>
                Categorization complete. 
                {validationData.length > 0 && (
                  <span className="ml-2">
                    Accuracy: {Math.round((results.filter(r => r.isCorrect === true).length / results.filter(r => r.isCorrect !== null).length) * 100)}%
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactionData.map((transaction) => {
                // Use partial results during streaming, final results when complete
                const result = (partialResults.length > 0 ? partialResults : results).find(r => r.id === transaction.id)
                
                return (
                  <div key={transaction.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">ID: {transaction.id}</div>
                        <div className="text-sm text-gray-600 mb-1">{transaction.description}</div>
                        <div className="text-sm text-gray-500">
                          {transaction.time} | {transaction.counterparty} | {transaction.amount}
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-2">
                        {result && result.category && (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {result.category}
                              </Badge>
                              {result.isCorrect !== null && (
                                result.isCorrect ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )
                              )}
                            </div>
                            {result.expectedCategory && result.isCorrect === false && (
                              <div className="text-xs text-gray-500">
                                Expected: {result.expectedCategory}
                              </div>
                            )}
                          </>
                        )}
                        {(!result || !result.category) && validationData[transaction.id - 1] && (
                          <Badge variant="secondary" className="text-xs">
                            Expected: {validationData[transaction.id - 1]}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaming Response Panel */}
      {showStreamingPanel && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className={`h-5 w-5 ${
                  streamingStatus === 'streaming' ? 'animate-spin text-blue-500' :
                  streamingStatus === 'parsing' ? 'text-yellow-500' :
                  streamingStatus === 'complete' ? 'text-green-500' :
                  streamingStatus === 'error' ? 'text-red-500' : 'text-gray-500'
                }`} />
                Streaming Response
                <Badge variant={
                  streamingStatus === 'streaming' ? 'default' :
                  streamingStatus === 'parsing' ? 'secondary' :
                  streamingStatus === 'complete' ? 'default' :
                  streamingStatus === 'error' ? 'destructive' : 'outline'
                }>
                  {streamingStatus === 'streaming' ? 'Receiving...' :
                   streamingStatus === 'parsing' ? 'Parsing...' :
                   streamingStatus === 'complete' ? 'Complete' :
                   streamingStatus === 'error' ? 'Error' : 'Idle'}
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStreamingPanel(false)}
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Real-time LLM response with Zod validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Raw streaming content */}
              <div>
                <div className="text-sm font-medium mb-2">Raw Response:</div>
                <div className="bg-gray-50 p-3 rounded-md max-h-40 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {streamingContent || 'Waiting for response...'}
                  </pre>
                </div>
              </div>

              {/* Partial results if available */}
              {partialResults.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">
                    Parsed Results ({partialResults.filter(r => r.category).length}/{partialResults.length}):
                  </div>
                  <div className="bg-blue-50 p-3 rounded-md max-h-40 overflow-y-auto">
                    <div className="space-y-1">
                      {partialResults.slice(0, 10).map((result, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <span>ID {result.id}: {result.description?.substring(0, 30)}...</span>
                          <div className="flex items-center gap-2">
                            {result.category && (
                              <Badge variant="outline" className="text-xs">
                                {result.category}
                              </Badge>
                            )}
                            {result.isCorrect !== null && (
                              result.isCorrect ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500" />
                              )
                            )}
                          </div>
                        </div>
                      ))}
                      {partialResults.length > 10 && (
                        <div className="text-xs text-gray-500 text-center">
                          ... and {partialResults.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      {transactionData.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <Button 
              onClick={generateCategorization}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate Categorization
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default App

