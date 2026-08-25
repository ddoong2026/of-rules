-- 1. users 테이블에 경제 관리 권한 컬럼 추가
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS economy_admin boolean DEFAULT false;

-- 2. 국고 초기값 세팅 (없을 경우 0으로 세팅)
INSERT INTO public.settings (key, value)
VALUES ('treasury_balance', '0')
ON CONFLICT (key) DO NOTHING;

-- 3. 국고(국세청)와 연동되는 트랜잭션 함수 신설
-- p_treasury_change: 국고 증감액 (징수하여 국고로 들어가면 양수, 지급하여 국고에서 빠지면 음수)
CREATE OR REPLACE FUNCTION process_treasury_transaction(
  p_user_id uuid,          -- 대상 학생 (받거나 내는 사람)
  p_amount integer,        -- 대상 학생의 잔액 증감 (징수면 음수, 지급이면 양수)
  p_treasury_change integer, -- 국고 증감액 (징수하여 국고로 들어가면 양수, 소각이면 0, 국고에서 빼서 주면 음수, 무한발행이면 0)
  p_description text,
  p_type text,
  p_actor_id uuid
) RETURNS void AS $$
DECLARE
  current_treasury integer;
BEGIN
  -- 1. 학생 트랜잭션 기록 및 잔액 업데이트
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, amount, description, type)
    VALUES (p_user_id, p_amount, p_description, p_type);
    
    UPDATE public.users
    SET balance = COALESCE(balance, 0) + p_amount
    WHERE id = p_user_id;
  END IF;

  -- 2. 국고 잔액 업데이트
  IF p_treasury_change != 0 THEN
    SELECT COALESCE(value::integer, 0) INTO current_treasury 
    FROM public.settings WHERE key = 'treasury_balance';
    
    UPDATE public.settings 
    SET value = (current_treasury + p_treasury_change)::text,
        updated_at = now()
    WHERE key = 'treasury_balance';
  END IF;

  -- 3. 활동 기록 남기기
  INSERT INTO public.activity_logs (user_id, action_type, description)
  VALUES (p_actor_id, 'TRANSACTION', '경제활동: ' || p_description || ' (학생증감: ' || p_amount || ', 국고증감: ' || p_treasury_change || ')');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
