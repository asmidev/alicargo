import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/crm/LanguageSwitcher';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      navigate('/crm');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: t('auth_error'),
          description: error.message,
          variant: 'destructive',
        });
      } else {
        navigate('/crm');
      }
    } catch (error: any) {
      toast({
        title: t('auth_error'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 bg-card border-border">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        
        <div className="text-center mb-6 sm:mb-8">
          <img src="/pwa-512x512.png" alt="AliBrand" className="w-20 h-20 rounded-3xl mx-auto mb-4 shadow-lg shadow-primary/20" />
          <h1 className="text-2xl font-bold text-foreground">AliBrand CRM</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {t('auth_login_title')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('auth_login_label')}
            </label>
            <Input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="username"
              required
              className="bg-input border-border"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('auth_password')}
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-input border-border"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold shadow-lg shadow-primary/30"
            disabled={loading}
          >
            {loading ? t('auth_loading') : t('auth_submit')}
          </Button>

        </form>
      </Card>
    </div>
  );
}
