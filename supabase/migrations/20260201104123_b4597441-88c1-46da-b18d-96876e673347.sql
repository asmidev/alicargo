-- 1. Junction table yaratish: box_track_codes
CREATE TABLE box_track_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  track_code TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- 2. Indexes for fast lookups
CREATE INDEX idx_box_track_codes_box_id ON box_track_codes(box_id);
CREATE INDEX idx_box_track_codes_track_code ON box_track_codes(track_code);
CREATE INDEX idx_box_track_codes_track_code_lower ON box_track_codes(LOWER(track_code));

-- 3. RLS policies
ALTER TABLE box_track_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Track codes viewable by authenticated"
  ON box_track_codes FOR SELECT USING (true);

CREATE POLICY "China staff can manage track codes"
  ON box_track_codes FOR ALL USING (
    has_role(auth.uid(), 'rahbar') OR 
    has_role(auth.uid(), 'bosh_admin') OR 
    has_role(auth.uid(), 'xitoy_manager') OR 
    has_role(auth.uid(), 'xitoy_packer')
  );

-- 4. Mavjud store_number larni migrate qilish
INSERT INTO box_track_codes (box_id, track_code, source, is_primary)
SELECT id, store_number, 'migration', true
FROM boxes
WHERE store_number IS NOT NULL AND store_number != '';