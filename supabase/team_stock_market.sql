-- Run after team_stocks.sql and economy_init.sql.
ALTER TABLE public.stocks ADD COLUMN IF NOT EXISTS team_id uuid UNIQUE REFERENCES public.stock_teams(id) ON DELETE CASCADE;
ALTER TABLE public.stocks ADD COLUMN IF NOT EXISTS issued_shares integer NOT NULL DEFAULT 0 CHECK (issued_shares >= 0);

CREATE TABLE IF NOT EXISTS public.stock_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
  limit_price integer NOT NULL CHECK (limit_price > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity >= 0),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FILLED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_trades (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  buy_order_id uuid NOT NULL REFERENCES public.stock_orders(id),
  sell_order_id uuid NOT NULL REFERENCES public.stock_orders(id),
  buyer_id uuid NOT NULL REFERENCES public.users(id),
  seller_id uuid NOT NULL REFERENCES public.users(id),
  price integer NOT NULL CHECK (price > 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.create_team_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO stocks (name, current_price, team_id) VALUES (NEW.name || ' 주식', 100, NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS create_team_stock_after_team ON public.stock_teams;
CREATE TRIGGER create_team_stock_after_team AFTER INSERT ON public.stock_teams
FOR EACH ROW EXECUTE FUNCTION public.create_team_stock();

-- Adds a stock for any team made before this migration.
INSERT INTO stocks (name, current_price, team_id)
SELECT t.name || ' 주식', 100, t.id FROM stock_teams t
WHERE NOT EXISTS (SELECT 1 FROM stocks s WHERE s.team_id = t.id);

ALTER TABLE public.stock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view order book" ON public.stock_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view trades" ON public.stock_trades FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow all for user_stocks" ON public.user_stocks;

CREATE OR REPLACE FUNCTION public.issue_team_shares(p_team_id uuid, p_user_id uuid, p_quantity integer, p_reference_price integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_stock_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'TEACHER') THEN RAISE EXCEPTION 'Teacher access required'; END IF;
  IF p_quantity <= 0 OR p_reference_price <= 0 THEN RAISE EXCEPTION 'Invalid issue'; END IF;
  SELECT id INTO v_stock_id FROM stocks WHERE team_id = p_team_id;
  IF v_stock_id IS NULL THEN RAISE EXCEPTION 'Team stock not found'; END IF;
  INSERT INTO user_stocks (user_id, stock_id, quantity, average_price) VALUES (p_user_id, v_stock_id, p_quantity, p_reference_price)
  ON CONFLICT (user_id, stock_id) DO UPDATE SET quantity = user_stocks.quantity + EXCLUDED.quantity;
  UPDATE stocks SET issued_shares = issued_shares + p_quantity, current_price = p_reference_price WHERE id = v_stock_id;
END; $$;

CREATE OR REPLACE FUNCTION public.place_team_stock_order(p_stock_id uuid, p_side text, p_quantity integer, p_limit_price integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order_id uuid; v_counter record; v_trade_qty integer; v_trade_price integer; v_buyer uuid; v_seller uuid; v_cost integer;
BEGIN
  IF p_side NOT IN ('BUY','SELL') OR p_quantity <= 0 OR p_limit_price <= 0 THEN RAISE EXCEPTION 'Invalid order'; END IF;
  IF NOT EXISTS (SELECT 1 FROM stocks WHERE id = p_stock_id AND team_id IS NOT NULL) THEN RAISE EXCEPTION 'Team stock not found'; END IF;
  IF p_side = 'SELL' AND COALESCE((SELECT quantity FROM user_stocks WHERE user_id = auth.uid() AND stock_id = p_stock_id), 0) - COALESCE((SELECT SUM(remaining_quantity) FROM stock_orders WHERE user_id = auth.uid() AND stock_id = p_stock_id AND side = 'SELL' AND status = 'OPEN'), 0) < p_quantity THEN RAISE EXCEPTION 'Not enough available shares'; END IF;
  INSERT INTO stock_orders(stock_id,user_id,side,limit_price,quantity,remaining_quantity) VALUES(p_stock_id,auth.uid(),p_side,p_limit_price,p_quantity,p_quantity) RETURNING id INTO v_order_id;
  LOOP
    SELECT * INTO v_counter FROM stock_orders WHERE stock_id=p_stock_id AND status='OPEN' AND id<>v_order_id
      AND ((p_side='BUY' AND side='SELL' AND limit_price<=p_limit_price) OR (p_side='SELL' AND side='BUY' AND limit_price>=p_limit_price))
      ORDER BY CASE WHEN p_side='BUY' THEN limit_price END ASC, CASE WHEN p_side='SELL' THEN limit_price END DESC, created_at ASC LIMIT 1 FOR UPDATE;
    EXIT WHEN v_counter.id IS NULL;
    SELECT * INTO v_counter FROM stock_orders WHERE id=v_counter.id FOR UPDATE;
    v_trade_qty := LEAST((SELECT remaining_quantity FROM stock_orders WHERE id=v_order_id), v_counter.remaining_quantity);
    EXIT WHEN v_trade_qty <= 0;
    v_trade_price := v_counter.limit_price;
    IF p_side='BUY' THEN v_buyer:=auth.uid(); v_seller:=v_counter.user_id; ELSE v_buyer:=v_counter.user_id; v_seller:=auth.uid(); END IF;
    v_cost := v_trade_qty * v_trade_price;
    IF COALESCE((SELECT balance FROM users WHERE id=v_buyer FOR UPDATE),0) < v_cost THEN RAISE EXCEPTION 'Buyer balance is insufficient'; END IF;
    UPDATE users SET balance=balance-v_cost WHERE id=v_buyer; UPDATE users SET balance=balance+v_cost WHERE id=v_seller;
    INSERT INTO transactions(user_id,amount,description,type) VALUES(v_buyer,-v_cost,'모둠주식 매수','STOCK_BUY'),(v_seller,v_cost,'모둠주식 매도','STOCK_SELL');
    UPDATE user_stocks SET quantity=quantity-v_trade_qty WHERE user_id=v_seller AND stock_id=p_stock_id;
    INSERT INTO user_stocks(user_id,stock_id,quantity,average_price) VALUES(v_buyer,p_stock_id,v_trade_qty,v_trade_price)
    ON CONFLICT(user_id,stock_id) DO UPDATE SET average_price=((user_stocks.quantity*user_stocks.average_price)+(v_trade_qty*v_trade_price))/(user_stocks.quantity+v_trade_qty), quantity=user_stocks.quantity+v_trade_qty;
    UPDATE stock_orders SET remaining_quantity=remaining_quantity-v_trade_qty, status=CASE WHEN remaining_quantity-v_trade_qty=0 THEN 'FILLED' ELSE 'OPEN' END WHERE id IN(v_order_id,v_counter.id);
    INSERT INTO stock_trades(stock_id,buy_order_id,sell_order_id,buyer_id,seller_id,price,quantity) VALUES(p_stock_id,CASE WHEN p_side='BUY' THEN v_order_id ELSE v_counter.id END,CASE WHEN p_side='SELL' THEN v_order_id ELSE v_counter.id END,v_buyer,v_seller,v_trade_price,v_trade_qty);
    UPDATE stocks SET current_price=v_trade_price, history=COALESCE(history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('date',now(),'price',v_trade_price,'quantity',v_trade_qty)) WHERE id=p_stock_id;
  END LOOP;
  RETURN v_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_team_stock_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE stock_orders SET status='CANCELLED' WHERE id=p_order_id AND user_id=auth.uid() AND status='OPEN'; END; $$;

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
  RETURN v_paid;
END; $$;

CREATE OR REPLACE FUNCTION public.adjust_team_dividend_pool(p_team_id uuid, p_amount integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id=auth.uid() AND role='TEACHER') THEN RAISE EXCEPTION 'Teacher access required'; END IF;
  IF p_amount = 0 THEN RETURN; END IF;
  UPDATE stock_teams SET dividend_pool=dividend_pool+p_amount WHERE id=p_team_id AND dividend_pool+p_amount>=0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dividend pool cannot be negative'; END IF;
  INSERT INTO dividend_credits(team_id,student_number,source_event_id,xp_delta,amount,source)
  VALUES(p_team_id,0,'manual-'||uuid_generate_v4(),1,abs(p_amount),'MANUAL: '||COALESCE(p_reason,''));
END; $$;
