import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamState {
  isStreaming: boolean;
  streamedContent: string;
  error: string | null;
  conversationId: string | null;
}

interface StreamOptions {
  onStart?: () => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string, conversationId: string) => void;
  onError?: (error: string) => void;
}

export function useAliAIStream() {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    streamedContent: '',
    error: null,
    conversationId: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const streamMessage = useCallback(async (
    message: string,
    existingConversationId: string | null,
    options?: StreamOptions
  ) => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState({
      isStreaming: true,
      streamedContent: '',
      error: null,
      conversationId: existingConversationId,
    });

    options?.onStart?.();

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ali-ai-brain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            message,
            conversationId: existingConversationId,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Get conversation ID from header
      const newConversationId = response.headers.get('X-Conversation-Id') || existingConversationId;

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullResponse = '';
      let isFirstChunk = true;

      // Helper function to clean and sanitize content - minimal approach
      const sanitizeContent = (content: string): string => {
        if (!content) return '';
        
        // Remove BOM (byte order mark)
        let cleaned = content.replace(/^\uFEFF/, '');
        
        // Remove control characters (except tab, newline, carriage return)
        cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // For first chunk, trim leading whitespace/newlines only
        if (isFirstChunk && cleaned.length > 0) {
          cleaned = cleaned.replace(/^[\s\n\r]+/, '');
          if (cleaned.length > 0) {
            isFirstChunk = false;
          }
        }
        
        return cleaned;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process complete lines only
        const lines = textBuffer.split('\n');
        // Keep the last potentially incomplete line in the buffer
        textBuffer = lines.pop() || '';

        for (let line of lines) {
          line = line.trim();
          
          // Skip empty lines, comments, and non-data lines
          if (!line || line.startsWith(':') || !line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              const sanitized = sanitizeContent(content);
              if (sanitized) {
                fullResponse += sanitized;
                options?.onChunk?.(sanitized);
                setState(prev => ({
                  ...prev,
                  streamedContent: fullResponse,
                  conversationId: newConversationId,
                }));
              }
            }
          } catch {
            // Incomplete JSON - this line might be split across chunks
            // Don't put it back, just skip it - next chunk will have the data
          }
        }
      }

      // Final flush - process any remaining complete data in buffer
      if (textBuffer.trim()) {
        const finalLines = textBuffer.split('\n');
        for (let raw of finalLines) {
          raw = raw.trim();
          if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              const sanitized = sanitizeContent(content);
              if (sanitized) {
                fullResponse += sanitized;
              }
            }
          } catch { /* ignore incomplete final chunk */ }
        }
      }
      
      // Final cleanup of the complete response
      fullResponse = fullResponse.trim();

      setState(prev => ({
        ...prev,
        isStreaming: false,
        streamedContent: fullResponse,
        conversationId: newConversationId,
      }));

      options?.onComplete?.(fullResponse, newConversationId || '');

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Stream aborted');
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: errorMessage,
      }));
      options?.onError?.(errorMessage);
    }
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  const reset = useCallback(() => {
    cancelStream();
    setState({
      isStreaming: false,
      streamedContent: '',
      error: null,
      conversationId: null,
    });
  }, [cancelStream]);

  return {
    ...state,
    streamMessage,
    cancelStream,
    reset,
  };
}
