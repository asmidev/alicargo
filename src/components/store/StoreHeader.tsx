import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/crm/LanguageSwitcher';

export function StoreHeader() {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { count } = useCart();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 store-glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-xl">
            <div className="w-9 h-9 rounded-lg gradient-gold-purple flex items-center justify-center text-white text-sm font-black shadow-lg">
              A
            </div>
            <span className="gradient-gold-purple-text font-extrabold tracking-tight">AliBrand</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link to="/catalog" className="text-muted-foreground hover:text-primary transition-colors relative group">
              {t('sf_catalog')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </Link>
            <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors relative group">
              {t('sf_about')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </Link>
            <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors relative group">
              {t('sf_contact')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
            </Link>
          </nav>

          <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sf_search_placeholder')}
                className="pl-10 bg-muted/30 border-border/50 focus-visible:ring-primary/50 focus-visible:border-primary/50"
              />
            </div>
          </form>

          <div className="flex items-center gap-1">
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:text-primary"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="w-5 h-5" />
            </Button>

            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <ShoppingCart className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full gradient-gold-purple text-white glow-gold-sm">
                    {count}
                  </span>
                )}
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:text-primary"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {searchOpen && (
          <form onSubmit={handleSearch} className="pb-3 md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sf_search_placeholder')}
                className="pl-10 bg-muted/30 border-border/50"
                autoFocus
              />
            </div>
          </form>
        )}

        {menuOpen && (
          <nav className="pb-4 flex flex-col gap-1 md:hidden border-t border-border/50 pt-3">
            <Link to="/catalog" className="py-2.5 px-3 rounded-lg hover:bg-primary/10 text-sm font-medium text-muted-foreground hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>
              {t('sf_catalog')}
            </Link>
            <Link to="/about" className="py-2.5 px-3 rounded-lg hover:bg-primary/10 text-sm font-medium text-muted-foreground hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>
              {t('sf_about')}
            </Link>
            <Link to="/contact" className="py-2.5 px-3 rounded-lg hover:bg-primary/10 text-sm font-medium text-muted-foreground hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>
              {t('sf_contact')}
            </Link>
            <Link to="/track" className="py-2.5 px-3 rounded-lg hover:bg-primary/10 text-sm font-medium text-muted-foreground hover:text-primary transition-colors" onClick={() => setMenuOpen(false)}>
              {t('sf_track_order')}
            </Link>
            <div className="px-3 pt-2">
              <LanguageSwitcher />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
