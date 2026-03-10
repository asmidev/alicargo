import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useAliAIStream } from '@/hooks/useAliAIStream';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { 
  Bot, 
  Trash2, 
  Plus, 
  Clock,
  Brain,
  ShieldCheck,
  Zap,
  StopCircle,
  Sparkles,
  Search,
  X,
  Menu,
  MoreVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  AliAIChatMessage, 
  AliAIChatInput, 
  AliAISuggestions, 
  AliAIExportButton,
  AliAIInsightsPanel,
  AliAIDailyDigest,
  AliAIFollowUpSuggestions,
  AliAILiveContext,
  AliAIPinnedMessages,
  AliAIConversationTags,
  getSuggestedQuestions 
} from '@/components/ali-ai';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AliAI() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { userRoles } = useUserRole();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [lastAssistantResponse, setLastAssistantResponse] = useState<string>('');
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { 
    isStreaming, 
    streamedContent, 
    streamMessage, 
    cancelStream, 
    error: streamError,
    conversationId: streamConversationId
  } = useAliAIStream();

  // Update active conversation when streaming creates a new one (only during active streaming)
  useEffect(() => {
    if (isStreaming && streamConversationId && streamConversationId !== activeConversationId) {
      setActiveConversationId(streamConversationId);
    }
  }, [streamConversationId, activeConversationId, isStreaming]);

  // Show stream errors
  useEffect(() => {
    if (streamError) {
      toast.error(streamError);
      setPendingMessage(null);
    }
  }, [streamError]);

  // Fetch conversations
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['ali-ai-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ali_ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!user,
  });

  // Fetch messages for active conversation
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['ali-ai-messages', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      
      const { data, error } = await supabase
        .from('ali_ai_messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!activeConversationId,
  });

  // Handle sending a message with streaming
  const handleSendMessage = useCallback(async (message: string) => {
    setPendingMessage(message);
    setShowFollowUps(false);
    
    await streamMessage(message, activeConversationId, {
      onStart: () => {
        console.log('Stream started');
      },
      onComplete: (fullResponse, convId) => {
        console.log('Stream complete:', fullResponse.length, 'chars');
        setPendingMessage(null);
        setLastAssistantResponse(fullResponse);
        setShowFollowUps(true);
        queryClient.invalidateQueries({ queryKey: ['ali-ai-messages', convId] });
        queryClient.invalidateQueries({ queryKey: ['ali-ai-conversations'] });
      },
      onError: (error) => {
        console.error('Stream error:', error);
        setPendingMessage(null);
      },
    });
  }, [activeConversationId, streamMessage, queryClient]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim() || !conversations) return conversations;
    return conversations.filter(conv => 
      conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // Delete conversation (confirmed)
  const handleDeleteConversation = async (conversationId: string) => {
    if (isStreaming) {
      toast.error(t('ai_cant_delete_streaming'));
      return;
    }

    setIsDeletingConversation(true);
    try {
      const { error } = await supabase
        .from('ali_ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        toast.error(t('ai_delete_error'));
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['ali-ai-conversations'] });
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }
      toast.success(t('ai_conversation_deleted'));
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const requestDeleteConversation = (conv: Conversation) => {
    setDeleteTarget(conv);
    setDeleteDialogOpen(true);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMessage, streamedContent]);

  const handleNewConversation = () => {
    cancelStream();
    setActiveConversationId(null);
    setPendingMessage(null);
    setShowFollowUps(false);
    setLastAssistantResponse('');
    setSidebarOpen(false);
  };

  const handleNavigateToPinnedMessage = (conversationId: string) => {
    setActiveConversationId(conversationId);
  };

  const handleSelectConversation = (convId: string) => {
    cancelStream();
    setPendingMessage(null);
    setShowFollowUps(false);
    setActiveConversationId(convId);
    setSidebarOpen(false);
  };

  const suggestedQuestions = getSuggestedQuestions(userRoles);
  const activeConversation = conversations?.find(c => c.id === activeConversationId);

  // Sidebar content (shared between desktop and mobile sheet)
  const SidebarContent = () => (
    <>
      {/* Conversations Card */}
      <Card className="flex-1 flex flex-col overflow-hidden min-h-0">
        <CardHeader className="py-2 px-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {conversations?.length || 0} {t('ai_conversations_count')}
            </span>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsSearching(!isSearching)}
                className="h-6 w-6 p-0"
              >
                {isSearching ? <X className="h-3 w-3" /> : <Search className="h-3 w-3" />}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNewConversation}
                className="h-6 text-xs px-2"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {/* Search input */}
          {isSearching && (
            <div className="mt-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('ai_search_conv')}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-1.5 min-h-0">
          <ScrollArea className="h-full">
            {conversationsLoading ? (
              <div className="space-y-1.5">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredConversations?.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">{searchQuery ? t('ai_no_results') : t('ai_no_conversations')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredConversations?.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-2 rounded-md cursor-pointer transition-all group ${
                      activeConversationId === conv.id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted border border-transparent'
                    }`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {conv.title || t('ai_new_conversation')}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {format(new Date(conv.updated_at), 'dd.MM HH:mm')}
                          </p>
                          <AliAIConversationTags conversationId={conv.id} compact />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isStreaming}
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteConversation(conv);
                        }}
                      >
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pinned Messages */}
      <AliAIPinnedMessages onNavigateToMessage={handleNavigateToPinnedMessage} />

      {/* Combined Insights & Digest in compact cards */}
      <div className="flex-shrink-0 space-y-2">
        <AliAIInsightsPanel compact />
        <AliAIDailyDigest compact />
      </div>
    </>
  );

  return (
    <>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        title={t('ai_delete_confirm')}
        description={deleteTarget?.title ? `"${deleteTarget.title}" ${t('ai_delete_description')}` : t('ai_delete_description')}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        variant="destructive"
        isLoading={isDeletingConversation}
        onConfirm={() => {
          if (deleteTarget) handleDeleteConversation(deleteTarget.id);
        }}
      />

      <div className={`${isMobile ? 'h-[calc(100vh-180px)]' : 'h-[calc(100vh-120px)]'} flex gap-3`}>
        {/* Left Sidebar - Desktop only */}
        {!isMobile && (
          <div className="w-64 flex-shrink-0 hidden lg:flex flex-col gap-2">
            <SidebarContent />
          </div>
        )}

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <CardHeader className="pb-2 border-b flex-shrink-0 px-3 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile sidebar trigger */}
                {isMobile && (
                  <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] p-3 flex flex-col gap-2">
                      <SheetHeader className="pb-2">
                        <SheetTitle className="text-sm">{t('ai_conversations')}</SheetTitle>
                      </SheetHeader>
                      <SidebarContent />
                    </SheetContent>
                  </Sheet>
                )}
                
                <div className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-gradient-to-br from-primary via-primary to-secondary flex items-center justify-center shadow-lg flex-shrink-0`}>
                  <Bot className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
                </div>
                <div className="min-w-0">
                  <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'} flex items-center gap-2`}>
                    Ali AI
                    <Badge variant={isStreaming ? "default" : "secondary"} className="text-xs font-normal">
                      {isStreaming ? (
                        <>
                          <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
                          {!isMobile && t('ai_writing')}
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3 mr-1" />
                          {!isMobile && t('ai_online')}
                        </>
                      )}
                    </Badge>
                  </CardTitle>
                  {!isMobile && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {userRoles[0] || 'user'} {t('ai_role_working')}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Desktop actions */}
              {!isMobile ? (
                <div className="flex items-center gap-2">
                  <AliAIConversationTags conversationId={activeConversationId} />
                  <AliAIExportButton 
                    conversationId={activeConversationId} 
                    conversationTitle={activeConversation?.title}
                  />
                  {isStreaming && (
                    <Button variant="outline" size="sm" onClick={cancelStream} className="text-destructive">
                      <StopCircle className="h-4 w-4 mr-1" />
                      {t('ai_stop')}
                    </Button>
                  )}
                </div>
              ) : (
                /* Mobile actions - condensed into dropdown */
                <div className="flex items-center gap-1">
                  {isStreaming && (
                    <Button variant="ghost" size="icon" onClick={cancelStream} className="h-9 w-9 text-destructive">
                      <StopCircle className="h-5 w-5" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleNewConversation()}>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('ai_new_conversation')}
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <div>
                          <AliAIExportButton 
                            conversationId={activeConversationId} 
                            conversationTitle={activeConversation?.title}
                          />
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </CardHeader>
          
          {/* Live Context Bar */}
          <div className="px-3 sm:px-4 py-2 border-b bg-muted/30">
            <AliAILiveContext userRoles={userRoles} />
          </div>
          
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-3 sm:p-4 w-full overflow-x-hidden">
            {/* Welcome screen */}
            {!activeConversationId && !streamConversationId && !messages?.length && !pendingMessage && !isStreaming && !lastAssistantResponse ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className={`${isMobile ? 'w-14 h-14' : 'w-20 h-20'} rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 flex items-center justify-center mb-4 sm:mb-6 animate-pulse`}>
                  <Bot className={`${isMobile ? 'h-7 w-7' : 'h-10 w-10'} text-primary`} />
                </div>
                <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold mb-2`}>{t('mp_ai_welcome')}</h3>
                <p className="text-muted-foreground mb-6 sm:mb-8 max-w-md text-sm">
                  {t('mp_ai_welcome_desc')}
                </p>
                
                {isMobile ? (
                  <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    <div className="flex gap-2 w-max">
                      {suggestedQuestions.map((q, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="whitespace-nowrap text-xs min-h-[40px]"
                          onClick={() => handleSendMessage(q)}
                        >
                          {q.length > 40 ? q.slice(0, 40) + '...' : q}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <AliAISuggestions 
                    suggestions={suggestedQuestions}
                    onSelect={handleSendMessage}
                  />
                )}
              </div>
            ) : messagesLoading && !pendingMessage && !isStreaming ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <Skeleton className="h-16 w-2/3 rounded-2xl" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 w-full min-w-0">
                {messages?.map((msg, index) => (
                  <AliAIChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    createdAt={msg.created_at}
                    messageId={msg.id}
                    conversationId={activeConversationId}
                    conversationTitle={activeConversation?.title}
                    showFeedback={msg.role === 'assistant' && index === (messages.length - 1)}
                  />
                ))}
                
                {/* Pending user message */}
                {pendingMessage && (
                  <AliAIChatMessage
                    role="user"
                    content={pendingMessage}
                    createdAt={new Date().toISOString()}
                  />
                )}
                
                {/* Streaming assistant response */}
                {isStreaming && (
                  <AliAIChatMessage
                    role="assistant"
                    content={streamedContent}
                    createdAt={new Date().toISOString()}
                    isStreaming
                    conversationId={activeConversationId}
                    showFeedback={false}
                  />
                )}
                
                {/* Follow-up suggestions after response completes */}
                {!isStreaming && showFollowUps && lastAssistantResponse && (
                  <AliAIFollowUpSuggestions
                    lastResponse={lastAssistantResponse}
                    onSelect={handleSendMessage}
                    isVisible={showFollowUps}
                  />
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <AliAIChatInput
            onSend={handleSendMessage}
            isLoading={isStreaming}
            placeholder={t('ai_ask_question')}
          />
        </Card>
      </div>
    </>
  );
}
