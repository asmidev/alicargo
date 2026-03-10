import { useState, useEffect } from 'react';
import { Tag, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

interface AliAIConversationTagsProps {
  conversationId: string | null;
  compact?: boolean;
  onTagsChange?: (tags: ConversationTag[]) => void;
}

const STORAGE_KEY = 'ali-ai-conversation-tags';
const PRESET_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
];

const PRESET_TAGS: ConversationTag[] = [
  { id: 'important', name: 'Muhim', color: 'bg-red-500' },
  { id: 'finance', name: 'Moliya', color: 'bg-green-500' },
  { id: 'products', name: 'Mahsulot', color: 'bg-blue-500' },
  { id: 'shipping', name: "Jo'natma", color: 'bg-orange-500' },
  { id: 'tasks', name: 'Vazifalar', color: 'bg-purple-500' },
  { id: 'analysis', name: 'Tahlil', color: 'bg-teal-500' },
];

interface TagsStorage {
  tags: ConversationTag[];
  conversationTags: Record<string, string[]>; // conversationId -> tag ids
}

export function AliAIConversationTags({ 
  conversationId, 
  compact = false,
  onTagsChange 
}: AliAIConversationTagsProps) {
  const [storage, setStorage] = useState<TagsStorage>({ tags: PRESET_TAGS, conversationTags: {} });
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  // Load from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setStorage({
          tags: [...PRESET_TAGS, ...(parsed.customTags || [])],
          conversationTags: parsed.conversationTags || {},
        });
      } catch (e) {
        console.error('Error parsing tags:', e);
      }
    }
  }, []);

  // Save to localStorage
  const saveStorage = (newStorage: TagsStorage) => {
    const customTags = newStorage.tags.filter(t => !PRESET_TAGS.some(pt => pt.id === t.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      customTags,
      conversationTags: newStorage.conversationTags,
    }));
    setStorage(newStorage);
  };

  const getConversationTags = (): ConversationTag[] => {
    if (!conversationId) return [];
    const tagIds = storage.conversationTags[conversationId] || [];
    return storage.tags.filter(t => tagIds.includes(t.id));
  };

  const toggleTag = (tagId: string) => {
    if (!conversationId) return;
    
    const currentTags = storage.conversationTags[conversationId] || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(id => id !== tagId)
      : [...currentTags, tagId];
    
    const newStorage = {
      ...storage,
      conversationTags: {
        ...storage.conversationTags,
        [conversationId]: newTags,
      },
    };
    
    saveStorage(newStorage);
    onTagsChange?.(storage.tags.filter(t => newTags.includes(t.id)));
  };

  const addCustomTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag: ConversationTag = {
      id: `custom-${Date.now()}`,
      name: newTagName.trim(),
      color: selectedColor,
    };
    
    const newStorage = {
      ...storage,
      tags: [...storage.tags, newTag],
    };
    
    saveStorage(newStorage);
    setNewTagName('');
    toast.success("Yangi teg qo'shildi");
  };

  const currentTags = getConversationTags();

  if (!conversationId) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {currentTags.slice(0, 2).map(tag => (
          <Badge 
            key={tag.id} 
            variant="secondary" 
            className={`${tag.color} text-white text-[10px] px-1.5 py-0`}
          >
            {tag.name}
          </Badge>
        ))}
        {currentTags.length > 2 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            +{currentTags.length - 2}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1">
          <Tag className="h-3.5 w-3.5" />
          {currentTags.length > 0 && (
            <span className="text-xs">{currentTags.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Teglar</span>
          </div>

          {/* Current tags */}
          {currentTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {currentTags.map(tag => (
                <Badge 
                  key={tag.id}
                  className={`${tag.color} text-white text-xs cursor-pointer`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          )}

          {/* All tags */}
          <div className="border-t pt-2">
            <p className="text-xs text-muted-foreground mb-2">Teg qo'shish:</p>
            <div className="flex flex-wrap gap-1">
              {storage.tags
                .filter(t => !currentTags.some(ct => ct.id === t.id))
                .map(tag => (
                  <Badge 
                    key={tag.id}
                    variant="outline"
                    className="text-xs cursor-pointer hover:opacity-80"
                    onClick={() => toggleTag(tag.id)}
                  >
                    <div className={`w-2 h-2 rounded-full ${tag.color} mr-1`} />
                    {tag.name}
                    <Plus className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
            </div>
          </div>

          {/* Add custom tag */}
          <div className="border-t pt-2 space-y-2">
            <p className="text-xs text-muted-foreground">Yangi teg:</p>
            <div className="flex gap-1">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Teg nomi"
                className="h-7 text-xs"
              />
              <Button 
                size="sm" 
                className="h-7"
                onClick={addCustomTag}
                disabled={!newTagName.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex gap-1">
              {PRESET_COLORS.slice(0, 6).map(color => (
                <button
                  key={color}
                  className={`w-5 h-5 rounded-full ${color} ${
                    selectedColor === color ? 'ring-2 ring-offset-1 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
