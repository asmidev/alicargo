import { Link } from 'react-router-dom';
import { Phone, Send } from 'lucide-react';
import { STORE } from '@/lib/storeConfig';
import { useTranslation } from 'react-i18next';

export function StoreFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border/50 bg-card/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg mb-3">
              <div className="w-8 h-8 rounded-lg gradient-gold-purple flex items-center justify-center text-white text-sm font-black">A</div>
              <span className="gradient-gold-purple-text font-extrabold">AliBrand</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('sf_footer_tagline')}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">{t('sf_pages')}</h4>
            <div className="space-y-2 text-sm">
              <Link to="/catalog" className="block text-muted-foreground hover:text-primary transition-colors">{t('sf_catalog')}</Link>
              <Link to="/about" className="block text-muted-foreground hover:text-primary transition-colors">{t('sf_about')}</Link>
              <Link to="/contact" className="block text-muted-foreground hover:text-primary transition-colors">{t('sf_contact')}</Link>
              <Link to="/track" className="block text-muted-foreground hover:text-primary transition-colors">{t('sf_track_order')}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">{t('sf_contact')}</h4>
            <div className="space-y-2 text-sm">
              <a href={`tel:${STORE.phoneRaw}`} className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                <Phone className="w-3.5 h-3.5" /> {STORE.phone}
              </a>
              <a href={STORE.telegramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                <Send className="w-3.5 h-3.5" /> Telegram
              </a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">{t('sf_info')}</h4>
            <p className="text-sm text-muted-foreground">{STORE.address}</p>
            <p className="text-sm text-muted-foreground mt-1">{STORE.workHours}</p>
          </div>
        </div>
        <div className="border-t border-border/50 mt-8 pt-6 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} AliBrand.uz — {t('sf_all_rights')}</p>
        </div>
      </div>
    </footer>
  );
}
