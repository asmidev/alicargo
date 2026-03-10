-- Add parent_id for subtasks support
ALTER TABLE public.tasks 
ADD COLUMN parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Create index for faster subtask queries
CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);

-- Create task attachments table
CREATE TABLE public.task_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on task_attachments
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_attachments
CREATE POLICY "Task attachments viewable by authenticated"
ON public.task_attachments FOR SELECT
USING (true);

CREATE POLICY "Users can upload attachments"
ON public.task_attachments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own attachments"
ON public.task_attachments FOR DELETE
USING (uploaded_by = auth.uid() OR has_role(auth.uid(), 'rahbar'::app_role) OR has_role(auth.uid(), 'bosh_admin'::app_role));

-- Create task activity log table
CREATE TABLE public.task_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  old_value text,
  new_value text,
  field_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on task_activity_log
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_activity_log
CREATE POLICY "Task activity viewable by authenticated"
ON public.task_activity_log FOR SELECT
USING (true);

CREATE POLICY "System can insert activity logs"
ON public.task_activity_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX idx_task_activity_log_task_id ON public.task_activity_log(task_id);
CREATE INDEX idx_task_activity_log_created_at ON public.task_activity_log(created_at DESC);

-- Enable realtime for task activity
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity_log;