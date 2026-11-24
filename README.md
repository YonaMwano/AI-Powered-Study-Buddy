# StudyBuddy AI

Turn any messy input (text, PDF, scans, slides, Word) into clean **explanations**, **quizzes**, and **flashcards**. Export to PDF / PPTX / DOCX.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Supabase** (Postgres + Auth + Storage + RLS)
- **Groq** (text + vision models)
- **kie.ai** (diagram / flashcard illustrations)
- Tailwind CSS v4 + lucide-react + Framer Motion + sonner
- Server-side document generation (`@react-pdf/renderer`, `pptxgenjs`, `docx`)

## Setup

1. Copy `.env.example` → `.env.local` and fill in your keys (never commit secrets).
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Create storage buckets (private unless noted):
   - `documents` (private)
   - `exports` (private)
   - `illustrations` (public)
4. Enable Email and optionally Google provider under Authentication → Providers.
5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/
    api/           # ingest, analyze, generate, export, studies
    studio/        # main create flow
    study/[id]/    # viewer (explainer / quiz / flashcards)
    library/       # history
    login|signup/  # auth
  components/      # UI + study views + export menu
  lib/
    ai/            # groq, generate, sanitize, illustrate
    export/        # pdf, pptx, docx builders
    ingest/        # detect + extract
    supabase/      # clients + middleware
  types/           # Zod schemas + domain types
supabase/
  schema.sql
```

## Design

Calm editorial aesthetic: warm paper light mode, deep slate dark mode, indigo accent.  
Zero markdown leakage — AI returns strict JSON; a sanitizer + Zod pipeline keeps exports clean.

## Scripts

- `npm run dev` — development
- `npm run build` — production build
- `npm run start` — start production server
- `npm run typecheck` — TypeScript check

## License

Private / educational use.
