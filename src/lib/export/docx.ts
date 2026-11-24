import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageBreak,
  AlignmentType,
} from "docx";
import type { Study } from "@/types";
import { difficultyLabel } from "./theme";

export async function buildDocxBuffer(study: Study): Promise<Buffer> {
  const sections = study.explainer?.sections ?? [];
  const questions = study.quiz?.questions ?? [];
  const cards = study.flashcards?.cards ?? [];

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: study.title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Difficulty: ${difficultyLabel(study.difficulty)}  ·  StudyBuddy AI`,
          size: 20,
          color: "64748B",
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Explainer
  children.push(
    new Paragraph({
      text: "Explainer",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
    })
  );

  for (const sec of sections) {
    children.push(
      new Paragraph({
        text: sec.heading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      })
    );
    for (const p of sec.body) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p, size: 22 })],
          spacing: { after: 120, line: 320 },
        })
      );
    }
    if (sec.keyPoints?.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Key points",
              bold: true,
              size: 20,
              color: "6366F1",
            }),
          ],
          spacing: { before: 120, after: 80 },
        })
      );
      for (const kp of sec.keyPoints) {
        children.push(
          new Paragraph({
            text: kp,
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
        );
      }
    }
  }

  // Quiz
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      text: "Quiz",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  questions.forEach((q, i) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${i + 1}. ${q.prompt}`,
            bold: true,
            size: 22,
          }),
        ],
        spacing: { before: 200, after: 80 },
      })
    );
    if (q.options) {
      q.options.forEach((opt, j) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${String.fromCharCode(65 + j)}. ${opt}`,
                size: 20,
              }),
            ],
            spacing: { after: 40 },
            indent: { left: 200 },
          })
        );
      });
    }
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Answer: ${q.answer}`,
            size: 20,
            color: "10B981",
            bold: true,
          }),
        ],
        spacing: { before: 60, after: 40 },
      })
    );
    if (q.explanation) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: q.explanation, size: 18, color: "64748B" }),
          ],
          spacing: { after: 120 },
        })
      );
    }
  });

  // Flashcards as 2-column table
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      text: "Flashcards",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  const tableRows: TableRow[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    const left = cards[i];
    const right = cards[i + 1];
    const cell = (c: typeof left | undefined) =>
      new TableCell({
        width: { size: 4500, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
        },
        children: c
          ? [
              new Paragraph({
                children: [
                  new TextRun({ text: c.front, bold: true, size: 20 }),
                ],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: c.back, size: 18, color: "475569" }),
                ],
              }),
            ]
          : [new Paragraph({ text: "" })],
      });
    tableRows.push(new TableRow({ children: [cell(left), cell(right)] }));
  }

  if (tableRows.length) {
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: tableRows,
      }) as unknown as Paragraph
    );
  }

  const doc = new Document({
    creator: "StudyBuddy AI",
    title: study.title,
    styles: {
      default: {
        document: {
          styles: [
            {
              id: "Normal",
              run: { font: "Calibri", size: 22 },
            },
          ],
        },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          run: { size: 48, bold: true, font: "Calibri", color: "0F172A" },
          paragraph: {
            spacing: { after: 200 },
            alignment: AlignmentType.LEFT,
          },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickStyle: true,
          run: { size: 32, bold: true, font: "Calibri", color: "0F172A" },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickStyle: true,
          run: { size: 26, bold: true, font: "Calibri", color: "0F172A" },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080,
              bottom: 1080,
              left: 1080,
              right: 1080,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
