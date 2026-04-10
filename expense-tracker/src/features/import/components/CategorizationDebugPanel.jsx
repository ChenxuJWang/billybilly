import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';

function copyToClipboard(text) {
  return navigator.clipboard.writeText(text).catch((error) => {
    console.error('Failed to copy debug text:', error);
  });
}

export default function CategorizationDebugPanel({
  streamingContent,
  streamingReasoningContent,
  streamingFinishReason,
  usage,
  debugInfo,
}) {
  const hasStreaming = streamingContent || streamingReasoningContent || streamingFinishReason || usage;
  const hasDebug = Boolean(debugInfo);

  if (!hasStreaming && !hasDebug) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {hasStreaming && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Engine Debug Stream</CardTitle>
                <CardDescription>Raw streaming output and token usage.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    `${streamingContent || ''}\n\nReasoning:\n${streamingReasoningContent || ''}`
                  )
                }
              >
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {streamingContent && (
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700">Content</div>
                  <div className="max-h-40 overflow-y-auto rounded bg-gray-100 p-3 text-sm font-mono">
                    {streamingContent}
                  </div>
                </div>
              )}
              {streamingReasoningContent && (
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700">Reasoning</div>
                  <div className="max-h-40 overflow-y-auto rounded bg-blue-50 p-3 text-sm font-mono">
                    {streamingReasoningContent}
                  </div>
                </div>
              )}
              {streamingFinishReason && (
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700">Finish Reason</div>
                  <div className="rounded bg-green-50 p-2 text-sm">{streamingFinishReason}</div>
                </div>
              )}
              {usage && (
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700">Token Usage</div>
                  <div className="rounded bg-purple-50 p-3 text-sm font-mono">
                    <p>Completion Tokens: {usage.completion_tokens}</p>
                    <p>Prompt Tokens: {usage.prompt_tokens}</p>
                    <p>Total Tokens: {usage.total_tokens}</p>
                    <p>Cached Tokens: {usage.prompt_tokens_details?.cached_tokens || 0}</p>
                    <p>Reasoning Tokens: {usage.completion_tokens_details?.reasoning_tokens || 0}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {hasDebug && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Raw Request Debug</CardTitle>
                <CardDescription>Request details used for categorization.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(debugInfo, null, 2))}
              >
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto rounded bg-gray-100 p-3 text-sm font-mono">
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
