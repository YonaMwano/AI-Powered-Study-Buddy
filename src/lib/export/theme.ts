/** Shared document theme so PDF / PPTX / DOCX look consistent */

export const DOC_THEME = {
  fontHeading: "Helvetica",
  fontBody: "Helvetica",
  accent: "#6366F1",
  accentLight: "#818CF8",
  ink: "#0F172A",
  muted: "#64748B",
  paper: "#FFFFFF",
  paperAlt: "#F8FAFC",
  success: "#10B981",
  border: "#E2E8F0",
  marginPt: 48, // ~0.67in
  marginIn: 0.75,
  lineHeight: 1.55,
  h1: 28,
  h2: 18,
  h3: 14,
  body: 11,
  small: 9,
} as const;

export function difficultyLabel(d: string): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}
