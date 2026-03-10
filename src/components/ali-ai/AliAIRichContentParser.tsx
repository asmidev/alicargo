import { useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { AliAIChartRenderer } from './AliAIChartRenderer';
import { AliAITableRenderer } from './AliAITableRenderer';
import { AliAIQuickAction } from './AliAIQuickAction';
import ReactMarkdown from 'react-markdown';

class ChartErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Chart render error:', error, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface ParsedContent {
  type: 'text' | 'chart' | 'table' | 'action';
  content: any;
}

interface AliAIRichContentParserProps {
  content: string;
  onAction?: (action: string, data?: any) => void;
}

// Parse special blocks from AI response
function parseContent(content: string): ParsedContent[] {
  const parts: ParsedContent[] = [];
  
  // Regex patterns for special blocks
  const chartPattern = /```chart\n?([\s\S]*?)```/g;
  const tablePattern = /```table\n?([\s\S]*?)```/g;
  const actionPattern = /```action\n?([\s\S]*?)```/g;
  
  let lastIndex = 0;
  const allMatches: { index: number; end: number; type: string; content: string }[] = [];
  
  // Find all chart blocks
  let match;
  while ((match = chartPattern.exec(content)) !== null) {
    allMatches.push({ index: match.index, end: match.index + match[0].length, type: 'chart', content: match[1] });
  }
  
  // Find all table blocks
  while ((match = tablePattern.exec(content)) !== null) {
    allMatches.push({ index: match.index, end: match.index + match[0].length, type: 'table', content: match[1] });
  }
  
  // Find all action blocks
  while ((match = actionPattern.exec(content)) !== null) {
    allMatches.push({ index: match.index, end: match.index + match[0].length, type: 'action', content: match[1] });
  }
  
  // Sort by index
  allMatches.sort((a, b) => a.index - b.index);
  
  // Build parts array
  for (const m of allMatches) {
    // Add text before this match
    if (m.index > lastIndex) {
      const textContent = content.slice(lastIndex, m.index).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }
    
    // Try to parse the special content
    try {
      const parsed = JSON.parse(m.content);
      parts.push({ type: m.type as any, content: parsed });
    } catch {
      // If parsing fails, treat as text
      parts.push({ type: 'text', content: m.content });
    }
    
    lastIndex = m.end;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      parts.push({ type: 'text', content: textContent });
    }
  }
  
  // If no special blocks found, return as single text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }
  
  return parts;
}

export function AliAIRichContentParser({ content, onAction }: AliAIRichContentParserProps) {
  const parts = useMemo(() => parseContent(content), [content]);
  
  return (
    <div className="space-y-3 w-full min-w-0">
      {parts.map((part, idx) => {
        switch (part.type) {
          case 'chart':
            return (
              <ChartErrorBoundary
                key={idx}
                fallback={<p className="text-sm text-muted-foreground">[Grafik yuklashda xato]</p>}
              >
                <div className="w-full overflow-x-auto">
                  <AliAIChartRenderer chartData={part.content} />
                </div>
              </ChartErrorBoundary>
            );
          
          case 'table':
            return (
              <ChartErrorBoundary
                key={idx}
                fallback={<p className="text-sm text-muted-foreground">[Jadval yuklashda xato]</p>}
              >
                <div className="w-full overflow-x-auto">
                  <AliAITableRenderer tableData={part.content} />
                </div>
              </ChartErrorBoundary>
            );
          
          case 'action':
            return (
              <ChartErrorBoundary
                key={idx}
                fallback={null}
              >
                <AliAIQuickAction
                  action={part.content}
                  onExecute={onAction}
                />
              </ChartErrorBoundary>
            );
          
          case 'text':
          default:
            return (
              <div key={idx} className="prose prose-sm dark:prose-invert max-w-none w-full min-w-0 break-words [overflow-wrap:anywhere] [word-break:break-word]">
                <ReactMarkdown
                  components={{
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-2 max-w-full">
                        <table className="min-w-full border-collapse text-sm">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border px-2 py-1 bg-muted font-medium text-left">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-2 py-1">{children}</td>
                    ),
                    pre: ({ children }) => (
                      <pre className="overflow-x-auto max-w-full bg-background/50 p-3 rounded-lg my-2">
                        {children}
                      </pre>
                    ),
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-background/50 px-1 py-0.5 rounded text-sm font-mono break-all" {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className="block text-sm font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]" {...props}>
                          {children}
                        </code>
                      );
                    },
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                    ),
                    p: ({ children }) => (
                      <p className="my-1 leading-relaxed break-words [overflow-wrap:anywhere]">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mt-3 mb-2 break-words">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-bold mt-2 mb-1 break-words">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-bold mt-2 mb-1 break-words">{children}</h3>
                    ),
                  }}
                >
                  {part.content}
                </ReactMarkdown>
              </div>
            );
        }
      })}
    </div>
  );
}
