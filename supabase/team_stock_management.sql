-- Run after team_stock_market.sql.
CREATE TABLE IF NOT EXISTS public.dividend_payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES public.stock_teams(id) ON DELETE CASCADE,
  per_share integer NOT NULL,
  total_paid integer NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid REFERENCES public.users(id)
);
ALTER TABLE public.dividend_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view dividend payments" ON public.dividend_payments FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_team_stock(p_team_id uuid, p_name text, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='TEACHER') THEN RAISE EXCEPTION 'Teacher access required'; END IF;
  UPDATE stock_teams SET name=trim(p_name), code=upper(trim(p_code)) WHERE id=p_team_id;
  UPDATE stocks SET name=trim(p_name)||' 주식' WHERE team_id=p_team_id;
END; $$;

CREATE OR REPLACE FUNCTION public.adjust_team_share_issue(p_team_id uuid, p_user_id uuid, p_delta integer, p_reference_price integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_stock uuid; v_holding integer; v_open_sell integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='TEACHER') THEN RAISE EXCEPTION 'Teacher access required'; END IF;
  IF p_delta=0 OR p_reference_price<=0 THEN RAISE EXCEPTION 'Invalid adjustment'; END IF;
  SELECT id INTO v_stock FROM stocks WHERE team_id=p_team_id;
  SELECT COALESCE(quantity,0) INTO v_holding FROM user_stocks WHERE user_id=p_user_id AND stock_id=v_stock;
  SELECT COALESCE(SUM(remaining_quantity),0) INTO v_open_sell FROM stock_orders WHERE user_id=p_user_id AND stock_id=v_stock AND side='SELL' AND status='OPEN';
  IF p_delta<0 AND v_holding-v_open_sell < -p_delta THEN RAISE EXCEPTION 'Open sell orders or holding quantity prevent this reduction'; END IF;
  INSERT INTO user_stocks(user_id,stock_id,quantity,average_price) VALUES(p_user_id,v_stock,GREATEST(p_delta,0),p_reference_price)
  ON CONFLICT(user_id,stock_id) DO UPDATE SET quantity=user_stocks.quantity+p_delta;
  UPDATE stocks SET issued_shares=issued_shares+p_delta WHERE id=v_stock AND issued_shares+p_delta>=0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issued shares cannot be negative'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_team_stock_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  RETURN COALESCE((SELECT jsonb_agg(row_data ORDER BY row_data->>'name') FROM (
    SELECT jsonb_build_object('team_id',t.id,'name',t.name,'code',t.code,'stock_id',s.id,'current_price',s.current_price,
      'issued_shares',s.issued_shares,'dividend_pool',t.dividend_pool,
      'total_held',COALESCE((SELECT SUM(h.quantity) FROM user_stocks h WHERE h.stock_id=s.id),0),
      'estimated_dividend_per_share',CASE WHEN COALESCE((SELECT SUM(h.quantity) FROM user_stocks h WHERE h.stock_id=s.id),0)>0 THEN t.dividend_pool/((SELECT SUM(h.quantity) FROM user_stocks h WHERE h.stock_id=s.id)) ELSE 0 END,
      'shareholders',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',u.name,'student_number',u.student_number,'quantity',h.quantity) ORDER BY h.quantity DESC) FROM user_stocks h JOIN users u ON u.id=h.user_id WHERE h.stock_id=s.id AND h.quantity>0),'[]'::jsonb)) AS row_data
    FROM stock_teams t JOIN stocks s ON s.team_id=t.id
  ) x),'[]'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.pay_team_dividend(p_team_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_stock_id uuid; v_pool integer; v_shares integer; v_per_share integer; v_paid integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='TEACHER') THEN RAISE EXCEPTION 'Teacher access required'; END IF;
  SELECT s.id,t.dividend_pool INTO v_stock_id,v_pool FROM stock_teams t JOIN stocks s ON s.team_id=t.id WHERE t.id=p_team_id FOR UPDATE;
  SELECT COALESCE(SUM(quantity),0) INTO v_shares FROM user_stocks WHERE stock_id=v_stock_id AND quantity>0;
  IF v_pool<=0 OR v_shares=0 THEN RAISE EXCEPTION 'No dividend pool or shareholders'; END IF;
  v_per_share:=v_pool/v_shares; IF v_per_share=0 THEN RAISE EXCEPTION 'Pool is too small'; END IF;
  UPDATE users u SET balance=u.balance+(h.quantity*v_per_share) FROM user_stocks h WHERE h.user_id=u.id AND h.stock_id=v_stock_id AND h.quantity>0;
  INSERT INTO transactions(user_id,amount,description,type) SELECT user_id,quantity*v_per_share,'모둠주식 배당','ETC' FROM user_stocks WHERE stock_id=v_stock_id AND quantity>0;
  v_paid:=v_per_share*v_shares; UPDATE stock_teams SET dividend_pool=dividend_pool-v_paid WHERE id=p_team_id;
  INSERT INTO dividend_payments(team_id,per_share,total_paid,paid_by) VALUES(p_team_id,v_per_share,v_paid,auth.uid());
  RETURN v_paid;
END; $$;
