import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function StoreBanner() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden rounded-2xl mx-4 mt-4 bg-gradient-to-br from-card via-card to-secondary/20 border border-border/50">
      <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-primary/10 blur-2xl animate-float" />
      <div className="absolute bottom-5 right-1/4 w-24 h-24 rounded-full bg-secondary/20 blur-xl animate-float-delayed" />
      <div className="absolute top-1/2 right-20 w-16 h-16 rounded-full bg-primary/5 blur-lg animate-float" />
      <div className="absolute top-0 left-0 w-full h-[2px] gradient-gold-purple opacity-60" />

      <div className="relative z-10 px-6 py-14 md:py-24 md:px-12 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-5">
          <Sparkles className="w-3 h-3" />
          {t('sf_premium_quality')}
        </div>
        
        <h1 className="text-3xl md:text-5xl font-extrabold text-foreground leading-tight mb-4 tracking-tight">
          {t('sf_hero_title')}{' '}
          <span className="gradient-gold-purple-text">{t('sf_hero_highlight')}</span>
        </h1>
        <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
          {t('sf_hero_subtitle')}
        </p>
        <Link to="/catalog">
          <Button size="lg" className="gap-2 text-base px-8 gradient-gold-purple text-white font-bold border-0 hover:opacity-90 transition-opacity glow-gold-sm">
            {t('sf_view_catalog')}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
