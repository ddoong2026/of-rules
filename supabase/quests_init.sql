CREATE TABLE IF NOT EXISTS public.user_quests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    map_id uuid REFERENCES public.maps(id) ON DELETE CASCADE,
    asset_id text NOT NULL,
    quest_title text NOT NULL,
    completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, map_id, asset_id)
);

-- RLS Policies
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quests"
    ON public.user_quests FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quests"
    ON public.user_quests FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Teachers can view all quests"
    ON public.user_quests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'TEACHER'
        )
    );
