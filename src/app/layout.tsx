import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "StudyBuddy AI — Turn any notes into explanations, quizzes & flashcards",
    template: "%s · StudyBuddy AI",
  },
  description:
    "Paste text or upload PDFs, scans, slides and Word docs. Get clean explanations, quizzes and flashcards. Export to PDF, PPTX or DOCX.",
  keywords: [
    "AI study",
    "flashcards",
    "quiz generator",
    "PDF to notes",
    "study buddy",
  ],
  openGraph: {
    title: "StudyBuddy AI",
    description: "Turn messy notes into structured learning materials.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable}`}
      suppressHydrationWarning
    >
      <body className="paper min-h-screen antialiased text-slate-900 dark:text-slate-100">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className:
                "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
