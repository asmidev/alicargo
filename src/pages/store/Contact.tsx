import { Phone, MapPin, Clock, Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { STORE } from '@/lib/storeConfig';
import { useTranslation } from 'react-i18next';

export default function StoreContact() {
  const { t } = useTranslation();
  useDocumentMeta({ title: t('sf_contact_title'), description: `AliBrand.uz — ${STORE.phone}` });

  const items = [
    { icon: Phone, title: t('sf_contact_phone'), value: STORE.phone, href: `tel:${STORE.phoneRaw}` },
    { icon: Send, title: t('sf_contact_telegram'), value: STORE.telegram, href: STORE.telegramUrl },
    { icon: MapPin, title: t('sf_contact_address'), value: STORE.address },
    { icon: Clock, title: t('sf_contact_hours'), value: STORE.workHours },
  ];

  return (
    <div className="px-4 py-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6">{t('sf_contact_title')}</h1>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {items.map(({ icon: Icon, title, value, href }) => (
          <div key={title} className="bg-card rounded-xl border border-border/50 p-5 transition-all hover:-translate-y-0.5 hover-glow-gold">
            <Icon className="w-6 h-6 text-primary mb-2" />
            <h3 className="font-semibold mb-1">{title}</h3>
            {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{value}</a> : <p className="text-sm text-muted-foreground">{value}</p>}
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl border border-primary/20 p-8 text-center glow-gold-sm">
        <MessageCircle className="w-10 h-10 mx-auto text-primary mb-3" />
        <h2 className="text-lg font-semibold mb-2">{t('sf_contact_question')}</h2>
        <p className="text-sm text-muted-foreground mb-5">{t('sf_contact_question_desc')}</p>
        <a href={STORE.telegramUrl} target="_blank" rel="noopener noreferrer">
          <Button className="gap-2 gradient-gold-purple text-white font-bold border-0 hover:opacity-90"><Send className="w-4 h-4" /> Telegram</Button>
        </a>
      </div>
    </div>
  );
}
