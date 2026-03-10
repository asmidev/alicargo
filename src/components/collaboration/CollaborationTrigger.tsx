import { UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollaboration } from '@/contexts/CollaborationContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';

export function CollaborationTrigger() {
  const { toggle } = useCollaboration();
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:h-10 sm:w-10 relative"
          onClick={toggle}
        >
          <UsersRound className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {t('collaboration', 'Hamkorlik')}
      </TooltipContent>
    </Tooltip>
  );
}
