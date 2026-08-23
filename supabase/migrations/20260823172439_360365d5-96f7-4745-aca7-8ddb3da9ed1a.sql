CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  important_years TEXT[] NOT NULL DEFAULT '{}',
  places TEXT[] NOT NULL DEFAULT '{}',
  people TEXT[] NOT NULL DEFAULT '{}',
  hobbies TEXT[] NOT NULL DEFAULT '{}',
  critical_docs TEXT[] NOT NULL DEFAULT '{}',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  kind TEXT NOT NULL DEFAULT 'other',
  date_taken DATE,
  category TEXT NOT NULL DEFAULT 'Document',
  tags TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT,
  is_junk BOOLEAN NOT NULL DEFAULT false,
  junk_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own files" ON public.files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX files_user_idx ON public.files (user_id, created_at DESC);

CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  month_day TEXT NOT NULL,
  year INTEGER NOT NULL,
  summary TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories" ON public.memories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX memories_capsule_idx ON public.memories (user_id, month_day);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();