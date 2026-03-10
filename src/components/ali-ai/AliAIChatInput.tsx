import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Loader2, Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface AliAIChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function AliAIChatInput({ onSend, isLoading, placeholder }: AliAIChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError,
  } = useSpeechRecognition({
    language: 'uz-UZ',
    continuous: true,
    interimResults: true,
    onResult: (text) => {
      setMessage(prev => prev + text + ' ');
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // Show speech errors
  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const handleSend = () => {
    if (!message.trim() || isLoading) return;

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    onSend(message.trim());
    setMessage('');
    resetTranscript();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex gap-2 items-end p-4 border-t bg-background">
      {/* Voice input button */}
      {isSpeechSupported && (
        <Button
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          onClick={toggleListening}
          disabled={isLoading}
          className={cn(
            "h-11 w-11 flex-shrink-0 transition-all",
            isListening && "animate-pulse"
          )}
          title={isListening ? t('ai_stop_voice') : t('ai_start_voice')}
        >
          {isListening ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      )}
      
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message + (interimTranscript ? interimTranscript : '')}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={isListening ? t('ai_speaking') : (placeholder || t('ai_ask_question'))}
          readOnly={isLoading}
          aria-disabled={isLoading}
          className={cn(
            "min-h-[44px] max-h-[150px] resize-none pr-4",
            isListening && "border-destructive/50 bg-destructive/5",
            isLoading && "opacity-70"
          )}
          rows={1}
        />
        
        {/* Listening indicator */}
        {isListening && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-xs text-destructive font-medium">REC</span>
          </div>
        )}
      </div>
      
      <Button 
        onClick={handleSend} 
        disabled={!message.trim() || isLoading}
        size="icon"
        className="h-11 w-11 flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
