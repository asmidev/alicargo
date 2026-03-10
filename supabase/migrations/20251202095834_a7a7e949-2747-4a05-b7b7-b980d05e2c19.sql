-- Simply remove all courier role assignments
-- The enum can remain unchanged, we just won't use the kuryer value
DELETE FROM public.user_roles WHERE role = 'kuryer';