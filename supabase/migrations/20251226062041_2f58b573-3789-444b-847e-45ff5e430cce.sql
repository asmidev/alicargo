-- Add recurring task columns to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_pattern jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS next_occurrence timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS template_id uuid DEFAULT NULL;

-- Create task templates table
CREATE TABLE public.task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  title_template text NOT NULL,
  description_template text,
  default_priority text DEFAULT 'medium',
  default_location text,
  default_entity_type text,
  estimated_duration_hours integer,
  created_by uuid NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on task_templates
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_templates
CREATE POLICY "Templates viewable by authenticated"
  ON public.task_templates FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage templates"
  ON public.task_templates FOR ALL
  USING (
    has_role(auth.uid(), 'rahbar'::app_role) OR 
    has_role(auth.uid(), 'bosh_admin'::app_role) OR 
    has_role(auth.uid(), 'xitoy_manager'::app_role) OR 
    has_role(auth.uid(), 'uz_manager'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Create task_dependencies table
CREATE TABLE public.task_dependencies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type text DEFAULT 'finish_to_start',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Enable RLS on task_dependencies
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_dependencies
CREATE POLICY "Dependencies viewable by authenticated"
  ON public.task_dependencies FOR SELECT
  USING (true);

CREATE POLICY "Managers can manage dependencies"
  ON public.task_dependencies FOR ALL
  USING (
    has_role(auth.uid(), 'rahbar'::app_role) OR 
    has_role(auth.uid(), 'bosh_admin'::app_role) OR 
    has_role(auth.uid(), 'xitoy_manager'::app_role) OR 
    has_role(auth.uid(), 'uz_manager'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_templates_created_by ON public.task_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON public.task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_next_occurrence ON public.tasks(next_occurrence) WHERE is_recurring = true;