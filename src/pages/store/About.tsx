import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Truck, Shield, ArrowRight } from 'lucide-react';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useTranslation } from 'react-i18next';

export default function StoreAbout() {
  const { t } = useTranslation();
  useDocumentMeta({ title: t('sf_about_title'), description: t('sf_about_desc') });

  const features = [
    { icon: Package, title: t('sf_about_products'), desc: t('sf_about_products_desc') },
    { icon: Truck, title: t('sf_about_delivery'), desc: t('sf_about_delivery_desc') },
    { icon: Shield, title: t('sf_about_guarantee'), desc: t('sf_about_guarantee_desc') },
  ];

  return (
    <div className="px-4 py-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6">{t('sf_about_title')}</h1>
      <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
        <strong className="text-primary">AliBrand.uz</strong> — {t('sf_about_desc')}
      </p>
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-card rounded-xl border border-border/50 p-6 text-center transition-all hover:-translate-y-1 hover-glow-gold">
            <Icon className="w-8 h-8 mx-auto text-primary mb-3" />
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
      <Link to="/catalog">
        <Button size="lg" className="gap-2 gradient-gold-purple text-white font-bold border-0 hover:opacity-90 glow-gold-sm">
          {t('sf_view_catalog')} <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </div>
  );
}
