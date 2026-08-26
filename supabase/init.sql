-- Class Republic (Phase 1) - Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  student_number integer NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'CITIZEN' CHECK (role IN ('CITIZEN', 'ASSEMBLY', 'PRESIDENT', 'MINISTER', 'TEACHER')),
  department text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. petitions table
CREATE TABLE public.petitions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id uuid NOT NULL REFERENCES public.users(id),
  title text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_ASSEMBLY', 'RESOLVED')),
  agree_count integer DEFAULT 0,
  response_type text CHECK (response_type IN ('REPLY', 'ENACT', 'AMEND')),
  response_content text,
  responder_id uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. petition_agreements table (Junction table to prevent duplicate votes)
CREATE TABLE public.petition_agreements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  petition_id uuid NOT NULL REFERENCES public.petitions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(petition_id, user_id)
);

-- 4. laws table
CREATE TABLE public.laws (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposer_id uuid NOT NULL REFERENCES public.users(id),
  title text NOT NULL,
  reason text NOT NULL,
  content text NOT NULL,
  target_department text NOT NULL,
  status text DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ASSEMBLY_PASSED', 'REJECTED', 'PROMULGATED')),
  rejection_reason text,
  votes_for integer DEFAULT 0,
  votes_against integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 5. law_votes table (Junction table to prevent duplicate votes)
CREATE TABLE public.law_votes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  law_id uuid NOT NULL REFERENCES public.laws(id) ON DELETE CASCADE,
  assembly_member_id uuid NOT NULL REFERENCES public.users(id),
  vote boolean NOT NULL, -- true for YES, false for NO
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(law_id, assembly_member_id)
);

-- 6. decrees table
CREATE TABLE public.decrees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  law_id uuid NOT NULL REFERENCES public.laws(id),
  department text NOT NULL,
  minister_id uuid NOT NULL REFERENCES public.users(id),
  title text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'MINISTER_APPROVED', 'PRESIDENT_APPROVED')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Function to handle petition agreement logic
CREATE OR REPLACE FUNCTION handle_new_petition_agreement()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment agree_count
  UPDATE public.petitions
  SET agree_count = agree_count + 1
  WHERE id = NEW.petition_id;
  
  -- Check if it should be moved to IN_ASSEMBLY
  UPDATE public.petitions
  SET status = 'IN_ASSEMBLY'
  WHERE id = NEW.petition_id 
    AND agree_count >= 4 
    AND status = 'PENDING';
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for petition agreements
CREATE TRIGGER on_petition_agreement_insert
AFTER INSERT ON public.petition_agreements
FOR EACH ROW EXECUTE FUNCTION handle_new_petition_agreement();

-- RLS (Row Level Security) - Simplified for Phase 1
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petition_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decrees ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users for now
CREATE POLICY "Allow read access for authenticated users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.petitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.petition_agreements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.laws FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.law_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON public.decrees FOR SELECT TO authenticated USING (true);

-- Allow insert/update based on rules
CREATE POLICY "Allow insert for authenticated users" ON public.petitions FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Allow insert for authenticated users" ON public.petition_agreements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Additional policies for ASSEMBLY, PRESIDENT, MINISTER would be added here based on auth roles.
