-- StudyBuddy AI - Full PostgreSQL Schema for Supabase
-- Works with publishable (anon) key only — no secret/service_role key required.
-- Run this in Supabase SQL Editor (can re-run safely).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('text', 'pdf_text', 'pdf_scan', 'docx', 'pptx', 'image')),
  original_url TEXT,
  original_filename TEXT,
  extracted_text TEXT,
  page_images JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'ingested' CHECK (status IN ('ingested', 'processing', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_guest_id ON public.documents(guest_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Guests can update guest documents" ON public.documents;

-- Authenticated: own rows. Anon/guest: rows with user_id NULL (guest paste flow)
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id IS NULL)
  );

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- STUDIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.studies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id TEXT,
  title TEXT NOT NULL,
  difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  explainer JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  quiz JSONB NOT NULL DEFAULT '{"questions":[]}'::jsonb,
  flashcards JSONB NOT NULL DEFAULT '{"cards":[]}'::jsonb,
  model_text TEXT,
  model_vision TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  has_diagrams BOOLEAN DEFAULT FALSE,
  has_flashcard_images BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_studies_user_id ON public.studies(user_id);
CREATE INDEX IF NOT EXISTS idx_studies_guest_id ON public.studies(guest_id);
CREATE INDEX IF NOT EXISTS idx_studies_created_at ON public.studies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studies_document_id ON public.studies(document_id);

ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own studies" ON public.studies;
DROP POLICY IF EXISTS "Users can insert own studies" ON public.studies;
DROP POLICY IF EXISTS "Users can update own studies" ON public.studies;
DROP POLICY IF EXISTS "Users can delete own studies" ON public.studies;

CREATE POLICY "Users can view own studies"
  ON public.studies FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own studies"
  ON public.studies FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (user_id IS NULL)
  );

CREATE POLICY "Users can update own studies"
  ON public.studies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own studies"
  ON public.studies FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- EXPORTS (signed-in users only for persistence)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'pptx', 'docx')),
  file_url TEXT,
  storage_path TEXT,
  bytes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_exports_study_id ON public.exports(study_id);
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON public.exports(user_id);

ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exports" ON public.exports;
DROP POLICY IF EXISTS "Users can insert own exports" ON public.exports;
DROP POLICY IF EXISTS "Users can update own exports" ON public.exports;

CREATE POLICY "Users can view own exports"
  ON public.exports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports"
  ON public.exports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exports"
  ON public.exports FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_studies_updated_at ON public.studies;
CREATE TRIGGER set_studies_updated_at
  BEFORE UPDATE ON public.studies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documents', 'documents', false),
  ('exports', 'exports', false),
  ('illustrations', 'illustrations', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth upload documents" ON storage.objects;
DROP POLICY IF EXISTS "auth read documents" ON storage.objects;
DROP POLICY IF EXISTS "auth upload exports" ON storage.objects;
DROP POLICY IF EXISTS "auth read exports" ON storage.objects;
DROP POLICY IF EXISTS "public read illustrations" ON storage.objects;

CREATE POLICY "auth upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth upload exports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth read exports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "public read illustrations"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'illustrations');
