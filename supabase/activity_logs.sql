-- Activity Logs Schema and Updates

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  description text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 교사만 볼 수 있도록 SELECT 정책 설정
CREATE POLICY "Allow read access for teacher" ON public.activity_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'TEACHER')
);

-- 누구나 로그는 남길 수 있음
CREATE POLICY "Allow insert for all" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 기존 트랜잭션 함수 업데이트 (활동 기록도 함께 남기기)
CREATE OR REPLACE FUNCTION process_transaction(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_type text,
  p_actor_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- 1. Insert transaction record
  INSERT INTO public.transactions (user_id, amount, description, type)
  VALUES (p_user_id, p_amount, p_description, p_type);
  
  -- 2. Update user balance
  UPDATE public.users
  SET balance = COALESCE(balance, 0) + p_amount
  WHERE id = p_user_id;

  -- 3. Log activity
  INSERT INTO public.activity_logs (user_id, action_type, description)
  VALUES (COALESCE(p_actor_id, p_user_id), 'TRANSACTION', '트랜잭션: ' || p_description || ' (' || p_amount || '돈)');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
