import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Shield, Key, RefreshCw, Search, Edit, Users as UsersIcon, Copy, Check, Eye, EyeOff, Wand2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const ROLE_KEYS = [
  'rahbar', 'bosh_admin', 'xitoy_manager', 'xitoy_packer', 'xitoy_receiver',
  'uz_manager', 'uz_receiver', 'uz_quality', 'moliya_xodimi', 'manager', 'investor',
];

// Generate a simple memorable password
const generatePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default function Users() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canManageUsers } = useUserRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: '',
  });
  const [showPassword, setShowPassword] = useState(true);
  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(false);
  const [editRoleDialog, setEditRoleDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('');

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  // Auto-generate password when dialog opens, reset state when closing
  const handleOpenDialog = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setFormData({ username: '', password: generatePassword(), role: '' });
      setCreatedCredentials(null);
      setShowPassword(true);
    } else {
      // Reset all state when dialog closes
      setCreatedCredentials(null);
      setFormData({ username: '', password: '', role: '' });
    }
  };

  // IMPORTANT: All hooks must be called before any early returns
  const { data: users, isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list-users' },
      });

      if (error) throw error;
      return data.users;
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create-user',
          username: formData.username,
          password: formData.password,
          role: formData.role,
        },
      });

      if (data?.error) {
        throw new Error(data.details || data.error);
      }

      if (error && !data) {
        throw new Error(t('usr_network_error'));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      // Store credentials for display
      setCreatedCredentials({ username: formData.username, password: formData.password });
      toast({ 
        title: t('usr_user_created'), 
        description: t('usr_user_created_desc')
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t('toast_error'), 
        description: error?.message || t('toast_unknown_error'), 
        variant: 'destructive' 
      });
    },
  });

  // Reset password mutation with auto-generated password
  const handleResetPasswordOpen = (user: any) => {
    setSelectedUser(user);
    setNewPassword(generatePassword());
    setResetPasswordDialog(true);
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'reset-password',
          userId,
          newPassword,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: t('usr_password_updated'),
        description: t('usr_password_updated_desc'),
      });
      setResetPasswordDialog(false);
      setNewPassword('');
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
    },
    onError: (error: any) => {
      toast({
        title: t('toast_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update-role',
          userId,
          role,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: t('usr_role_updated'),
        description: t('usr_role_updated_desc'),
      });
      setEditRoleDialog(false);
      setNewRole('');
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: t('toast_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete-user',
          userId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: t('usr_user_deleted'),
        description: t('usr_user_deleted_desc'),
      });
      setDeleteDialog(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: t('toast_error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEditRole = (user: any) => {
    setSelectedUser(user);
    setNewRole(user.roles?.[0] || '');
    setEditRoleDialog(true);
  };

  const handleDeleteClick = (user: any) => {
    setSelectedUser(user);
    setDeleteDialog(true);
  };

  // Check authorization AFTER all hooks - only Chief Manager can manage users
  if (!canManageUsers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 bg-card border-border text-center">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('usr_access_denied')}</h2>
          <p className="text-muted-foreground">
            {t('usr_access_denied_msg')}
          </p>
        </Card>
      </div>
    );
  }

  const filteredUsers = users?.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.profiles?.full_name?.toLowerCase().includes(query) ||
      user.user_roles?.[0]?.role?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t('usr_title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isLoading ? t('usr_loading') : t('usr_count', { count: users?.length || 0 })}
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20 min-h-[44px] w-full sm:w-auto">
              <UserPlus className="h-4 w-4" />
              {t('usr_new_user')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {createdCredentials ? t('usr_created_title') : t('usr_create_title')}
              </DialogTitle>
            </DialogHeader>
            
            {createdCredentials ? (
              // Success state - show credentials to copy
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                   <p className="text-sm text-muted-foreground mb-3">
                    {t('usr_save_credentials')}
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 p-3 bg-background rounded-md">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('usr_login')}</p>
                        <p className="font-mono font-medium text-foreground">{createdCredentials.username}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(createdCredentials.username, 'username')}
                        className="shrink-0"
                      >
                        {copiedField === 'username' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2 p-3 bg-background rounded-md">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('usr_password')}</p>
                        <p className="font-mono font-medium text-foreground">{createdCredentials.password}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                        className="shrink-0"
                      >
                        {copiedField === 'password' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => copyToClipboard(`Login: ${createdCredentials.username}\nParol: ${createdCredentials.password}`, 'all')}
                  >
                    {copiedField === 'all' ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                    {t('usr_copy_all')}
                  </Button>
                </div>
                
                <Button
                  onClick={() => handleOpenDialog(false)}
                  className="w-full bg-gradient-to-r from-primary to-secondary"
                >
                  {t('close')}
                </Button>
              </div>
            ) : (
              // Form state
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    {t('usr_login')}
                  </label>
                  <Input
                    placeholder="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="bg-input border-border font-mono"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('usr_login_hint')}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    {t('usr_password')}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="bg-input border-border font-mono pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setFormData({ ...formData, password: generatePassword() })}
                      title={t('usr_generate_password')}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    {t('usr_role')}
                  </label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder={t('usr_select_role')} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {ROLE_KEYS.map((roleKey) => (
                        <SelectItem key={roleKey} value={roleKey}>
                          {t(`role_${roleKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => createUserMutation.mutate()}
                  disabled={!formData.username || !formData.password || !formData.role || createUserMutation.isPending}
                  className="w-full bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/20"
                >
                  {createUserMutation.isPending ? t('usr_creating') : t('usr_create_btn')}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 sm:p-6 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t('usr_all_users')}</h2>
          {isLoading && (
            <LoadingSkeleton count={1} compact />
          )}
        </div>
        
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('usr_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border min-h-[44px]"
            />
          </div>
        </div>
        
        {isLoading ? (
          <LoadingSkeleton count={4} />
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-xl transition-colors duration-200 hover:bg-muted/70"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">
                      {user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{t('usr_login')}: {user.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">ID: {user.id.substring(0, 8)}</p>
                    <div className="flex gap-2 mt-2">
                      {user.roles.map((role: string) => (
                        <span
                          key={role}
                          className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                        >
                          {t(`role_${role}`)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditRole(user)}
                    className="gap-2 min-h-[44px] transition-all duration-200 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('usr_role')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetPasswordOpen(user)}
                    className="gap-2 min-h-[44px] transition-all duration-200 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('usr_password')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(user)}
                    className="gap-2 min-h-[44px] border-destructive text-destructive hover:bg-destructive/10 transition-all duration-200 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : users && users.length > 0 ? (
          <div className="text-center py-12">
            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-2">
              {t('usr_no_results')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('usr_no_results_hint')}
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <UsersIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t('usr_no_users')}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              {t('usr_no_users_hint')}
            </p>
            <Button 
              onClick={() => handleOpenDialog(true)}
              className="gap-2 bg-gradient-to-r from-primary to-secondary"
            >
              <UserPlus className="h-4 w-4" />
              {t('usr_first_user')}
            </Button>
          </div>
        )}
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialog} onOpenChange={setResetPasswordDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('usr_reset_password')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{t('usr_user_label')}</p>
              <p className="font-medium text-foreground">{selectedUser?.full_name}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                {t('usr_new_password')}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-input border-border font-mono pr-10"
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => copyToClipboard(newPassword, 'newpass')}
                  >
                    {copiedField === 'newpass' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setNewPassword(generatePassword())}
                  title={t('usr_generate_password')}
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button
              onClick={() => {
                if (selectedUser && newPassword) {
                  resetPasswordMutation.mutate({ 
                    userId: selectedUser.id, 
                    newPassword 
                  });
                }
              }}
              disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}
              className="w-full bg-gradient-to-r from-primary to-secondary"
            >
              {resetPasswordMutation.isPending ? t('usr_updating') : t('usr_reset_password')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialog} onOpenChange={setEditRoleDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{t('usr_change_role')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">{t('usr_login')}: {selectedUser?.full_name}</strong> — {t('usr_select_new_role', { name: selectedUser?.full_name })}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t('usr_new_role')}
              </label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder={t('usr_select_role')} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {ROLE_KEYS.map((roleKey) => (
                    <SelectItem key={roleKey} value={roleKey}>
                      {t(`role_${roleKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => {
                if (selectedUser && newRole) {
                  updateRoleMutation.mutate({ 
                    userId: selectedUser.id, 
                    role: newRole 
                  });
                }
              }}
              disabled={!newRole || updateRoleMutation.isPending}
              className="w-full bg-gradient-to-r from-primary to-secondary"
            >
              {updateRoleMutation.isPending ? t('usr_updating') : t('usr_change_role')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog}
        onOpenChange={setDeleteDialog}
        title={t('usr_delete_user')}
        description={t('usr_delete_confirm', { name: selectedUser?.full_name })}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        onConfirm={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
        variant="destructive"
        isLoading={deleteUserMutation.isPending}
      />
    </div>
  );
}
