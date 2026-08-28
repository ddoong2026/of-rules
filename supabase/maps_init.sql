-- 3D Maps Table
CREATE TABLE public.maps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT '새 맵',
  heights jsonb NOT NULL,
  colors jsonb NOT NULL,
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  decals jsonb NOT NULL DEFAULT '[]'::jsonb,
  boundaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  "spawnPoint" jsonb NOT NULL DEFAULT '[0,0,0]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS (Row Level Security)
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

-- 교사만 맵을 생성, 수정, 삭제할 수 있도록 설정
CREATE POLICY "Teachers can manage maps" ON public.maps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'TEACHER'
    )
  );

-- 누구나 맵을 조회할 수 있도록 설정 (학생들이 맵을 볼 수 있도록)
CREATE POLICY "Anyone can view maps" ON public.maps
  FOR SELECT
  USING (true);
