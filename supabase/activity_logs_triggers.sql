-- Trigger for Petitions
CREATE OR REPLACE FUNCTION log_petition_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action_type, description)
    VALUES (NEW.author_id, 'PETITION', '새 청원 등록: ' || NEW.title);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'IN_ASSEMBLY' THEN
    INSERT INTO public.activity_logs (user_id, action_type, description)
    VALUES (NEW.author_id, 'PETITION', '청원 국회 회부: ' || NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_petition_activity ON public.petitions;
CREATE TRIGGER on_petition_activity
AFTER INSERT OR UPDATE ON public.petitions
FOR EACH ROW EXECUTE FUNCTION log_petition_activity();

-- Trigger for Laws
CREATE OR REPLACE FUNCTION log_law_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action_type, description)
    VALUES (NEW.proposer_id, 'LAW', '새 법률안 발의: ' || NEW.title);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.activity_logs (user_id, action_type, description)
    VALUES (NEW.proposer_id, 'LAW', '법률안 상태 변경 (' || NEW.status || '): ' || NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_law_activity ON public.laws;
CREATE TRIGGER on_law_activity
AFTER INSERT OR UPDATE ON public.laws
FOR EACH ROW EXECUTE FUNCTION log_law_activity();

-- Trigger for Decrees
CREATE OR REPLACE FUNCTION log_decree_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action_type, description)
    VALUES (NEW.minister_id, 'DECREE', '새 명령(Decree) 초안 작성: ' || NEW.title);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO public.activity_logs (user_id, action_type, description)
    VALUES (NEW.minister_id, 'DECREE', '명령(Decree) 상태 변경 (' || NEW.status || '): ' || NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_decree_activity ON public.decrees;
CREATE TRIGGER on_decree_activity
AFTER INSERT OR UPDATE ON public.decrees
FOR EACH ROW EXECUTE FUNCTION log_decree_activity();
