import { z } from "zod";

// ============================================================
// Core Domain Types
// ============================================================

export type SourceType =
  | "text"
  | "pdf_text"
  | "pdf_scan"
  | "docx"
  | "pptx"
  | "image";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type ExportFormat = "pdf" | "pptx" | "docx";

export type DocumentStatus = "ingested" | "processing" | "failed";

export type ExportStatus = "pending" | "processing" | "ready" | "failed";

// ============================================================
// Explainer
// ============================================================

export const ExplainerSectionSchema = z.object({
  heading: z.string().max(60),
  body: z.array(z.string()),
  keyPoints: z.array(z.string()).max(8),
  diagramPrompt: z.string().optional(),
  diagramUrl: z.string().url().optional().nullable(),
});

export type ExplainerSection = z.infer<typeof ExplainerSectionSchema>;

export const ExplainerSchema = z.object({
  sections: z.array(ExplainerSectionSchema),
});

export type Explainer = z.infer<typeof ExplainerSchema>;

// ============================================================
// Quiz
// ============================================================

export const QuizQuestionSchema = z.object({
  type: z.enum(["mcq", "short", "truefalse"]),
  prompt: z.string(),
  options: z.array(z.string()).length(4).optional(),
  answer: z.string(),
  explanation: z.string(),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSchema = z.object({
  questions: z.array(QuizQuestionSchema),
});

export type Quiz = z.infer<typeof QuizSchema>;

// ============================================================
// Flashcards
// ============================================================

export const FlashcardSchema = z.object({
  front: z.string(),
  back: z.string(),
  imagePrompt: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
});

export type Flashcard = z.infer<typeof FlashcardSchema>;

export const FlashcardsSchema = z.object({
  cards: z.array(FlashcardSchema),
});

export type Flashcards = z.infer<typeof FlashcardsSchema>;

// ============================================================
// Full Study Generation Output
// ============================================================

export const StudyGenerationSchema = z.object({
  title: z.string().max(120),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  explainer: ExplainerSchema,
  quiz: QuizSchema,
  flashcards: FlashcardsSchema,
});

export type StudyGeneration = z.infer<typeof StudyGenerationSchema>;

// ============================================================
// Database Row Types
// ============================================================

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  theme: "light" | "dark" | "system";
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string | null;
  guest_id: string | null;
  source_type: SourceType;
  original_url: string | null;
  original_filename: string | null;
  extracted_text: string | null;
  page_images: string[];
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
}

export interface Study {
  id: string;
  document_id: string | null;
  user_id: string | null;
  guest_id: string | null;
  title: string;
  difficulty: Difficulty;
  explainer: Explainer;
  quiz: Quiz;
  flashcards: Flashcards;
  model_text: string | null;
  model_vision: string | null;
  tokens_in: number;
  tokens_out: number;
  has_diagrams: boolean;
  has_flashcard_images: boolean;
  created_at: string;
  updated_at: string;
}

export interface Export {
  id: string;
  study_id: string;
  user_id: string | null;
  format: ExportFormat;
  file_url: string | null;
  storage_path: string | null;
  bytes: number;
  status: ExportStatus;
  error_message: string | null;
  created_at: string;
  expires_at: string;
}

// ============================================================
// API Payloads
// ============================================================

export interface GenerateRequest {
  text?: string;
  documentId?: string;
  difficulty?: Difficulty;
  includeDiagrams?: boolean;
  includeFlashcardImages?: boolean;
  guestId?: string;
}

export interface IngestResponse {
  documentId: string;
  sourceType: SourceType;
  extractedTextPreview: string;
  pageCount?: number;
}

export interface GenerateResponse {
  studyId: string;
  title: string;
}

export interface ExportRequest {
  studyId: string;
  format: ExportFormat;
}

export interface ExportJobResponse {
  jobId: string;
  status: ExportStatus;
  signedUrl?: string;
  bytes?: number;
  expiresIn?: number;
}
