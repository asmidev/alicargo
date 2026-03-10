import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Globe } from 'lucide-react';

const languages = [
  { code: 'uz', name: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 rounded-full px-3 py-2 h-9 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background hover:border-border transition-all duration-200"
        >
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg leading-none">{currentLanguage.flag}</span>
          <span className="hidden sm:inline text-sm font-medium">{currentLanguage.name}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-44 bg-popover border-border shadow-lg rounded-xl p-1.5 z-50"
        sideOffset={8}
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`
              cursor-pointer rounded-lg px-3 py-2.5 flex items-center gap-3
              transition-all duration-150
              ${i18n.language === lang.code 
                ? 'bg-primary/10 text-primary font-medium' 
                : 'hover:bg-muted'
              }
            `}
          >
            <span className="text-lg">{lang.flag}</span>
            <span className="flex-1">{lang.name}</span>
            {i18n.language === lang.code && (
              <Check className="h-4 w-4 text-primary animate-scale-in" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
