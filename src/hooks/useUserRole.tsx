import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserRole() {
  const { user } = useAuth();

  const { data: userRoles, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(r => r.role);
    },
    enabled: !!user?.id,
  });

  const hasRole = (role: string) => {
    return userRoles?.includes(role as any) || false;
  };

  const hasAnyRole = (roles: string[]) => {
    return roles.some(role => hasRole(role));
  };

  // Role-based access helpers
  const isOwner = hasRole('rahbar');
  const isChiefManager = hasRole('bosh_admin');
  const isAdmin = hasAnyRole(['rahbar', 'bosh_admin']);
  const isChinaManager = hasRole('xitoy_manager');
  const isChinaStaff = hasRole('xitoy_packer');
  const isUzManager = hasRole('uz_manager');
  const isUzStaff = hasRole('uz_receiver');
  const isFinanceStaff = hasRole('moliya_xodimi');
  const isMarketplaceManager = hasRole('manager'); // Use 'manager' role for marketplace management
  const isInvestor = hasRole('investor');
  const isCourier = hasRole('kuryer');
  const isSupport = hasRole('manager'); // Support role maps to manager

  // Permission groups
  const isManager = hasAnyRole(['rahbar', 'bosh_admin', 'xitoy_manager', 'uz_manager']);
  const isFinance = hasAnyRole(['rahbar', 'moliya_xodimi']);
  const canManageUsers = hasRole('bosh_admin'); // Only Chief Manager can manage accounts
  const canAccessFinance = hasAnyRole(['rahbar', 'moliya_xodimi']);
  const canAccessInvestorReports = hasRole('rahbar');

  return {
    userRoles: userRoles || [],
    hasRole,
    hasAnyRole,
    // Individual roles
    isOwner,
    isChiefManager,
    isAdmin,
    isChinaManager,
    isChinaStaff,
    isUzManager,
    isUzStaff,
    isFinanceStaff,
    isMarketplaceManager,
    isInvestor,
    isCourier,
    isSupport,
    // Permission groups
    isManager,
    isFinance,
    canManageUsers,
    canAccessFinance,
    canAccessInvestorReports,
    isLoading,
  };
}
