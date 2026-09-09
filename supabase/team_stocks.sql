-- Team stocks and dividend pool
CREATE TABLE IF NOT EXISTS public.stock_teams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  dividend_pool integer NOT NULL DEFAULT 0 CHECK (dividend_pool >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_team_members (
  team_id uuid NOT NULL REFERENCES public.stock_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.dividend_credits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES public.stock_teams(id) ON DELETE CASCADE,
  student_number integer NOT NULL,
  source_event_id text NOT NULL UNIQUE,
  xp_delta integer NOT NULL CHECK (xp_delta > 0),
  amount integer NOT NULL CHECK (amount > 0),
  source text NOT NULL DEFAULT 'READING_APP',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividend_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock teams" ON public.stock_teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view stock team members" ON public.stock_team_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view dividend credits" ON public.dividend_credits
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can manage stock teams" ON public.stock_teams
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'TEACHER'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'TEACHER'));
CREATE POLICY "Teachers can manage stock team members" ON public.stock_team_members
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'TEACHER'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'TEACHER'));

-- Called only by the server route. Repeated source_event_id values are ignored,
-- so retries from the reading app cannot credit a dividend pool twice.
CREATE OR REPLACE FUNCTION public.credit_team_dividend(
  p_student_number integer,
  p_group_code text,
  p_xp_delta integer,
  p_source_event_id text,
  p_amount integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid;
DECLARE v_credit_id uuid;
BEGIN
  SELECT t.id INTO v_team_id
  FROM stock_teams t
  JOIN stock_team_members m ON m.team_id = t.id
  JOIN users u ON u.id = m.user_id
  WHERE u.student_number = p_student_number AND t.code = p_group_code;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Student/team mapping not found';
  END IF;

  INSERT INTO dividend_credits (team_id, student_number, source_event_id, xp_delta, amount)
  VALUES (v_team_id, p_student_number, p_source_event_id, p_xp_delta, p_amount)
  ON CONFLICT (source_event_id) DO NOTHING
  RETURNING id INTO v_credit_id;

  IF v_credit_id IS NOT NULL THEN
    UPDATE stock_teams SET dividend_pool = dividend_pool + p_amount WHERE id = v_team_id;
  END IF;

  RETURN v_credit_id;
END;
$$;
