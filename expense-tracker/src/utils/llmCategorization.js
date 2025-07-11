import { z } from 'zod';
import { parse, Allow } from 'partial-json';

// Zod schema for transaction categorization response
const TransactionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  Id: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  category: z.string().optional(),
  cat: z.string().optional()
}).transform(data => ({
  id: data.id || data.Id || '',
  category: data.category || data.cat || ''
}));

const ResponseSchema = z.object({
  transactions: z.array(TransactionSchema)
});

// Helper function to try parsing JSON with Zod validation
export const tryParseStreamingJSON = (content) => {
  try {
    // Clean up the content - remove markdown code blocks
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) {
      cleanContent = cleanContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    // Try to parse as JSON using partial-json
    const parsed = parse(cleanContent, Allow.ALL);
    
    // Validate with Zod
    const validated = ResponseSchema.parse(parsed);
    
    return { success: true, data: validated };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Function to call LLM API with streaming
export const callLLMCategorization = async (
  transactions, 
  systemPrompt, 
  apiKey, 
  onStreamUpdate, 
  onPartialResults,
  abortSignal,
  thinkingEnabled = false,
  onDebugUpdate = null
) => {
  // Prepare CSV data for the API
  const csvHeaders = "Date,Description,Amount,Type,Counterparty";
  const csvData = csvHeaders + "\n" + transactions.map(t => 
    `"${t.date.toISOString()}","${t.description}","${t.amount}","${t.type}","${t.counterparty || ''}"`
  ).join('\n');

  const userMessage = "Please categorize the following transactions:";
  const fullUserMessage = `${userMessage}\n\nCSV Data:\n${csvData}`;

  const requestBody = {
    messages: [
      {
        content: systemPrompt,
        role: "system"
      },
      {
        content: fullUserMessage,
        role: "user"
      }
    ],
    model: "doubao-seed-1-6-flash-250615",
    stream: true,
    thinking: {
      type: thinkingEnabled ? "enabled" : "disabled"
    }
  };

  const requestHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  // Send debug info if callback provided
  if (onDebugUpdate) {
    const debugInfo = {
      url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      method: 'POST',
      headers: requestHeaders,
      body: requestBody
    };
    onDebugUpdate(debugInfo);
  }

  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
    signal: abortSignal
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let fullReasoningContent = '';
  let lastFinishReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            const choice = parsed.choices[0];
            const delta = choice.delta;
            
            // Capture content
            if (delta && delta.content) {
              const newContent = delta.content;
              fullContent += newContent;
            }
            
            // Capture reasoning content
            if (delta && delta.reasoning_content) {
              fullReasoningContent += delta.reasoning_content;
            }
            
            // Capture finish reason
            if (choice.finish_reason) {
              lastFinishReason = choice.finish_reason;
            }
            
            // Update streaming content display with all available info
            const streamingData = {
              content: fullContent,
              reasoningContent: fullReasoningContent,
              finishReason: lastFinishReason,
              rawDelta: delta,
              rawChoice: choice
            };
            onStreamUpdate(streamingData);
            
            // Try to parse and validate the current content
            if (fullContent) {
              const parseResult = tryParseStreamingJSON(fullContent);
              if (parseResult.success) {
                onPartialResults(parseResult.data);
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors for streaming data
          console.warn('Failed to parse streaming data:', e);
        }
      }
    }
  }

  // Final parsing and validation
  const finalParseResult = tryParseStreamingJSON(fullContent);
  
  if (finalParseResult.success) {
    return {
      ...finalParseResult.data,
      reasoningContent: fullReasoningContent,
      finishReason: lastFinishReason
    };
  } else {
    throw new Error(`Failed to parse final response: ${finalParseResult.error}`);
  }
};

