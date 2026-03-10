-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.boxes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;

-- Set REPLICA IDENTITY FULL for complete row data in realtime updates
ALTER TABLE public.boxes REPLICA IDENTITY FULL;
ALTER TABLE public.product_items REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.shipments REPLICA IDENTITY FULL;