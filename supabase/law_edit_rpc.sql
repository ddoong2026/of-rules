-- 법률안 수정 시 기존 투표(law_votes) 삭제 및 상태 리셋
CREATE OR REPLACE FUNCTION reset_law_votes(p_law_id uuid)
RETURNS void AS $$
BEGIN
  -- 1. 기존 투표 내역 전부 삭제
  DELETE FROM public.law_votes WHERE law_id = p_law_id;
  
  -- 2. 찬성/반대 수 초기화 및 상태를 다시 PROPOSED로 변경
  UPDATE public.laws
  SET 
    votes_for = 0, 
    votes_against = 0, 
    status = 'PROPOSED'
  WHERE id = p_law_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
