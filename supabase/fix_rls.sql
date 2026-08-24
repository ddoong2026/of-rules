-- 1. 법률안(laws) 등록 권한
CREATE POLICY "Allow insert for authenticated users" ON public.laws FOR INSERT TO authenticated WITH CHECK (auth.uid() = proposer_id);

-- 2. 법률안(laws) 수정 권한 (투표수 업데이트 등)
CREATE POLICY "Allow update for authenticated users" ON public.laws FOR UPDATE TO authenticated USING (true);

-- 3. 법률안(laws) 삭제 권한 (교사)
CREATE POLICY "Allow delete for authenticated users" ON public.laws FOR DELETE TO authenticated USING (true);

-- 4. 투표(law_votes) 권한
CREATE POLICY "Allow insert for authenticated users" ON public.law_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = assembly_member_id);

-- 5. 청원(petitions) 삭제 권한 (교사)
CREATE POLICY "Allow delete for authenticated users" ON public.petitions FOR DELETE TO authenticated USING (true);
