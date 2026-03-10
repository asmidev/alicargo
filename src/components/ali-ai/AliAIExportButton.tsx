import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileJson, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Message {
  role: string;
  content: string;
  created_at: string;
}

interface AliAIExportButtonProps {
  conversationId: string | null;
  conversationTitle?: string;
}

export function AliAIExportButton({ conversationId, conversationTitle }: AliAIExportButtonProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  const fetchMessages = async (): Promise<Message[]> => {
    if (!conversationId) return [];

    const { data, error } = await supabase
      .from('ali_ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  };

  const exportAsJSON = async () => {
    setIsExporting(true);
    try {
      const messages = await fetchMessages();
      
      const exportData = {
        title: conversationTitle || 'Ali AI Suhbat',
        exportedAt: new Date().toISOString(),
        messageCount: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ali-ai-chat-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(t('ai_export_json'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('ai_export_error'));
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsText = async () => {
    setIsExporting(true);
    try {
      const messages = await fetchMessages();
      
      let textContent = `Ali AI Suhbat\n`;
      textContent += `Eksport: ${format(new Date(), 'dd.MM.yyyy HH:mm')}\n`;
      textContent += `Xabarlar: ${messages.length}\n`;
      textContent += `${'='.repeat(50)}\n\n`;

      messages.forEach(m => {
        const role = m.role === 'user' ? 'Siz' : 'Ali AI';
        const time = format(new Date(m.created_at), 'HH:mm');
        textContent += `[${time}] ${role}:\n${m.content}\n\n`;
      });

      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ali-ai-chat-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(t('ai_export_txt'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('ai_export_error'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!conversationId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="ml-1 hidden sm:inline">{t('export')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportAsText}>
          <FileText className="h-4 w-4 mr-2" />
          {t('ai_text_file')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsJSON}>
          <FileJson className="h-4 w-4 mr-2" />
          JSON (.json)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
