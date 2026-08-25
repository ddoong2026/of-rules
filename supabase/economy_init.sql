-- Economy System Schema Update

-- 1. Settings table for currency name
CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default currency name if not exists
INSERT INTO public.settings (key, value)
VALUES ('currency_name', '미소')
ON CONFLICT (key) DO NOTHING;

-- 2. Add balance and job to users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS balance integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS job text;

-- 3. Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('SALARY', 'FINE', 'SHOP', 'DEPOSIT', 'WITHDRAWAL', 'STOCK_BUY', 'STOCK_SELL', 'INTEREST', 'ETC')),
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Shop Items
CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  price integer NOT NULL,
  description text,
  stock integer DEFAULT -1, -- -1 means infinite
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 5. Purchases
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
  price_paid integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Bank Accounts (Savings)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  principal integer NOT NULL,
  interest_rate decimal NOT NULL, -- e.g. 0.05 for 5%
  status text DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  created_at timestamp with time zone DEFAULT now(),
  closed_at timestamp with time zone
);

-- 7. Stocks
CREATE TABLE IF NOT EXISTS public.stocks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  current_price integer NOT NULL,
  history jsonb DEFAULT '[]'::jsonb, -- Store price history [{date, price}]
  created_at timestamp with time zone DEFAULT now()
);

-- Insert some default stocks
INSERT INTO public.stocks (name, current_price)
VALUES 
  ('규칙전자', 5000),
  ('학급건설', 3000),
  ('나라식품', 1500)
ON CONFLICT DO NOTHING;

-- 8. User Stocks (Portfolio)
CREATE TABLE IF NOT EXISTS public.user_stocks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stock_id uuid NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  average_price decimal NOT NULL DEFAULT 0,
  UNIQUE(user_id, stock_id)
);


-- Setup RLS (Row Level Security)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stocks ENABLE ROW LEVEL SECURITY;

-- Policies for public reading
CREATE POLICY "Allow read access for authenticated users" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.shop_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.stocks FOR SELECT TO authenticated USING (true);

-- Users can read their own data
CREATE POLICY "Users can read own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can read own purchases" ON public.purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can read own bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can read own user_stocks" ON public.user_stocks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Only teachers/ministers can modify balance and transactions directly
-- For simplicity in Phase 1, we will allow inserting transactions via RPC or client if we want, but ideally RPC.
-- In development, we can grant all for TEACHER/MINISTER via application logic.
-- So we allow insert for authenticated users, but UI will restrict.
CREATE POLICY "Allow insert for all" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert for all" ON public.purchases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert for all" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for all" ON public.bank_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow all for user_stocks" ON public.user_stocks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for shop_items" ON public.shop_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow update settings" ON public.settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow update stocks" ON public.stocks FOR ALL TO authenticated USING (true);

-- RPC for safe transactions (transfer money and log it atomically)
CREATE OR REPLACE FUNCTION process_transaction(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_type text
) RETURNS void AS $$
BEGIN
  -- 1. Insert transaction record
  INSERT INTO public.transactions (user_id, amount, description, type)
  VALUES (p_user_id, p_amount, p_description, p_type);
  
  -- 2. Update user balance
  UPDATE public.users
  SET balance = COALESCE(balance, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expose table updates for Realtime (if not already enabled)
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.stocks;
