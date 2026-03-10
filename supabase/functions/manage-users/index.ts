import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get and validate authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Extract the token from the header
    const token = authHeader.replace('Bearer ', '');

    // Create a client with the user's token to verify JWT properly
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // CRITICAL: Pass token explicitly for Lovable Cloud (verify_jwt = false)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if user has bosh_admin role using admin client
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Roles check error:', rolesError.message);
      return new Response(
        JSON.stringify({ error: 'Permission check failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const isBoshAdmin = roles?.some(r => r.role === 'bosh_admin');
    if (!isBoshAdmin) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { action, userId, newPassword, username, password, role } = await req.json();

    if (action === 'list-users') {
      // OPTIMIZED: Fetch all data in parallel with fewer queries
      const [profilesResult, allRolesResult, authUsersResult] = await Promise.all([
        // Get all profiles
        supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false }),
        // Get all roles in one query
        supabaseAdmin
          .from('user_roles')
          .select('user_id, role'),
        // Get all auth users in one call
        supabaseAdmin.auth.admin.listUsers()
      ]);

      if (profilesResult.error) throw profilesResult.error;

      const profiles = profilesResult.data || [];
      const allRoles = allRolesResult.data || [];
      const authUsers = authUsersResult.data?.users || [];

      // Create lookup maps for O(1) access
      const rolesMap = new Map<string, string[]>();
      allRoles.forEach(r => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      const emailMap = new Map<string, string>();
      authUsers.forEach(u => {
        emailMap.set(u.id, u.email || 'N/A');
      });

      // Map profiles with roles and emails
      const usersWithDetails = profiles.map(profile => ({
        ...profile,
        email: emailMap.get(profile.id) || 'N/A',
        roles: rolesMap.get(profile.id) || [],
      }));

      return new Response(
        JSON.stringify({ users: usersWithDetails }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'reset-password') {
      if (!userId || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'Missing userId or newPassword' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Password reset successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'update-role') {
      if (!userId || !role) {
        return new Response(
          JSON.stringify({ error: 'Missing userId or role' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Delete existing roles
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Insert new role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert([{ user_id: userId, role: role }]);

      if (roleError) throw roleError;

      return new Response(
        JSON.stringify({ success: true, message: 'Role updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'delete-user') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing userId' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Delete user roles first
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Delete user from auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authError) throw authError;

      return new Response(
        JSON.stringify({ success: true, message: 'User deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'create-user') {
      if (!username || !password || !role) {
        return new Response(
          JSON.stringify({ error: 'Missing username, password, or role' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      try {
        // Generate internal email from username
        const internalEmail = `${username}@alibrand.internal`;

        // Create user using admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: internalEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            username: username,
          },
        });

        if (createError) throw createError;
        if (!newUser.user) throw new Error('Failed to create user');

        // Update profile and assign role in parallel
        await Promise.all([
          supabaseAdmin
            .from('profiles')
            .update({ full_name: username })
            .eq('id', newUser.user.id),
          supabaseAdmin
            .from('user_roles')
            .insert([{ user_id: newUser.user.id, role: role }])
        ]);

        return new Response(
          JSON.stringify({ success: true, message: 'User created successfully', userId: newUser.user.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } catch (createUserError) {
        const errorMessage = createUserError instanceof Error ? createUserError.message : 'Unknown error';
        
        if (errorMessage.includes('already been registered')) {
          return new Response(
            JSON.stringify({ error: 'Bu login allaqachon band', details: 'Boshqa login tanlang' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        
        return new Response(
          JSON.stringify({ error: 'Foydalanuvchi yaratib bo\'lmadi', details: errorMessage }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
