-- Create task priority and status enums
DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'todo',
  entity_type TEXT, -- 'box', 'shipment', 'product', 'claim', etc.
  entity_id UUID,
  location TEXT, -- 'china', 'uzbekistan'
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task comments table
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Tasks viewable by authenticated users"
ON public.tasks FOR SELECT
USING (true);

CREATE POLICY "Managers can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'xitoy_manager'::app_role) OR 
  has_role(auth.uid(), 'uz_manager'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Managers and assignees can update tasks"
ON public.tasks FOR UPDATE
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR 
  has_role(auth.uid(), 'xitoy_manager'::app_role) OR 
  has_role(auth.uid(), 'uz_manager'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  assigned_to = auth.uid() OR
  created_by = auth.uid()
);

CREATE POLICY "Managers can delete tasks"
ON public.tasks FOR DELETE
USING (
  has_role(auth.uid(), 'rahbar'::app_role) OR 
  has_role(auth.uid(), 'bosh_admin'::app_role) OR
  created_by = auth.uid()
);

-- RLS Policies for task comments
CREATE POLICY "Task comments viewable by authenticated users"
ON public.task_comments FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create comments"
ON public.task_comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own comments"
ON public.task_comments FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
ON public.task_comments FOR DELETE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'rahbar'::app_role) OR has_role(auth.uid(), 'bosh_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);

-- Enable realtime for tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;