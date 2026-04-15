import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  workshop: {
    title: string;
    description: string | null;
    customerName: string | null;
    facilitatorName: string;
    createdAt: string;
  };
  sessions: { id: string; title: string; sortOrder: number }[];
  challenges: { id: string; text: string; source: string; sessionId: string | null; clusterId: string | null; participantName: string }[];
  clusters: { id: string; name: string; summary: string | null; sessionId: string; challenges: { id: string; text: string; participantName: string }[] }[];
  hkvQuestions: { id: string; fullText: string; isApproved: boolean; isAiGenerated: boolean; clusterId: string; clusterName: string; sessionId: string }[];
  ideas: {
    id: string; title: string; description: string | null; isAiGenerated: boolean; sessionId: string; hkvQuestionId: string | null; hkvText: string; clusterId: string | null; clusterName: string; participantName: string | null;
    score: { utilityValue: string; feasibility: string; matrixQuadrant: string; dataAvailability: string | null; systemReadiness: string | null; timeHorizon: string | null } | null;
    canvas: { problemStatement: string; solutionSummary: string; dataNeeds: string; stakeholders: string | null; firstSteps: string; expectedOutcome: string | null } | null;
  }[];
}

// Atea brand colors (from PDF guide)
const C = {
  green: [0, 138, 0] as [number, number, number],
  darkGrey: [51, 51, 51] as [number, number, number],
  midGrey: [77, 87, 93] as [number, number, number],
  textBody: [60, 60, 60] as [number, number, number],
  textMuted: [130, 130, 130] as [number, number, number],
  lightBg: [245, 246, 247] as [number, number, number],
  greenLight: [230, 245, 230] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
};

const QUAD_LABELS: Record<string, string> = {
  PRIORITER_NA: 'Prioriter na',
  STRATEGISKE_SATSINGER: 'Strategiske satsinger',
  RASKE_GEVINSTER: 'Raske gevinster',
  PARKER: 'Parker',
};

const VALUE_LABELS: Record<string, string> = {
  HIGH: 'Hoy',
  MEDIUM: 'Middels',
  LOW: 'Lav',
};

const PW = 210; // page width
const PH = 297; // page height
const M = 25;   // margin
const CW = PW - 2 * M; // content width

function s(val: unknown): string {
  if (val == null) return '';
  return String(val);
}

export function generateReport(data: ReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;
  let pageNum = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > PH - 20) {
      doc.addPage();
      pageNum++;
      y = M;
      drawHeader();
    }
  };

  const drawHeader = () => {
    // Thin green top line (Atea style)
    doc.setFillColor(...C.green);
    doc.rect(0, 0, PW, 2.5, 'F');
  };

  const drawFooter = () => {
    // Bottom bar
    doc.setDrawColor(...C.lightBg);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 15, PW - M, PH - 15);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textMuted);
    doc.text(s(data.workshop.title) + '  |  Design Sprint Light', M, PH - 10);
    doc.text(String(pageNum), PW - M, PH - 10, { align: 'right' });

    // Green bottom accent
    doc.setFillColor(...C.green);
    doc.rect(0, PH - 3, PW, 3, 'F');
  };

  // Helper: section heading (large, bold, dark)
  const sectionHeading = (text: string) => {
    ensureSpace(20);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.darkGrey);
    doc.text(text, M, y);
    y += 4;
    // Green underline
    doc.setDrawColor(...C.green);
    doc.setLineWidth(1);
    doc.line(M, y, M + 35, y);
    y += 10;
  };

  // Helper: sub heading
  const subHeading = (text: string) => {
    ensureSpace(12);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.darkGrey);
    doc.text(text, M, y);
    y += 7;
  };

  // Helper: body text
  const bodyText = (text: string, indent = 0) => {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textBody);
    const lines = doc.splitTextToSize(text, CW - indent);
    for (const line of lines) {
      ensureSpace(5);
      doc.text(line, M + indent, y);
      y += 4.5;
    }
  };

  // Helper: quote box (green left border, light bg)
  const quoteBox = (text: string) => {
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, CW - 14);
    const boxH = lines.length * 5 + 6;
    ensureSpace(boxH + 4);

    // Light green background
    doc.setFillColor(...C.greenLight);
    doc.roundedRect(M, y - 2, CW, boxH, 1, 1, 'F');

    // Green left border
    doc.setFillColor(...C.green);
    doc.rect(M, y - 2, 2.5, boxH, 'F');

    // Quote text
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...C.darkGrey);
    doc.text(lines, M + 8, y + 3);
    y += boxH + 4;
  };

  // Helper: info row (label: value)
  const infoRow = (label: string, value: string) => {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.midGrey);
    doc.text(label, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textBody);
    doc.text(value, M + 42, y);
    y += 6;
  };

  // ===================================
  // COVER PAGE
  // ===================================
  pageNum = 1;

  // Full-height dark background
  doc.setFillColor(35, 40, 45);
  doc.rect(0, 0, PW, PH, 'F');

  // Green accent strip at top
  doc.setFillColor(...C.green);
  doc.rect(0, 0, PW, 4, 'F');

  // Large title
  doc.setFontSize(38);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  const titleLines = doc.splitTextToSize(s(data.workshop.title), CW);
  doc.text(titleLines, M, 80);

  let cy = 80 + titleLines.length * 16;

  // Subtitle/description
  if (data.workshop.description) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    const descLines = doc.splitTextToSize(s(data.workshop.description), CW);
    doc.text(descLines, M, cy + 5);
    cy += 5 + descLines.length * 7;
  }

  // Green divider
  cy += 15;
  doc.setFillColor(...C.green);
  doc.rect(M, cy, 50, 2, 'F');
  cy += 20;

  // Metadata on cover
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);

  const coverMeta: [string, string][] = [];
  if (data.workshop.customerName) coverMeta.push(['Kunde', s(data.workshop.customerName)]);
  coverMeta.push(['Fasilitator', s(data.workshop.facilitatorName)]);
  try {
    coverMeta.push(['Dato', new Date(data.workshop.createdAt).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })]);
  } catch {
    coverMeta.push(['Dato', s(data.workshop.createdAt)]);
  }

  for (const [label, value] of coverMeta) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.white);
    doc.text(label, M, cy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text(value, M + 35, cy);
    cy += 8;
  }

  // ATEA logo at bottom
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text('ATEA', PW - M, PH - 20, { align: 'right' });

  // Small tagline
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text('Design Sprint Light  |  Workshop-rapport', PW - M, PH - 13, { align: 'right' });

  // ===================================
  // TABLE OF CONTENTS
  // ===================================
  doc.addPage();
  pageNum = 2;
  drawHeader();
  y = M + 10;

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.darkGrey);
  doc.text('Innhold', M, y);
  y += 5;
  doc.setFillColor(...C.green);
  doc.rect(M, y, 30, 1.5, 'F');
  y += 15;

  // TOC entries
  const tocEntries: string[] = [];
  for (const session of (data.sessions || [])) {
    tocEntries.push(session.title);
  }
  if ((data.sessions || []).length > 1) {
    tocEntries.push('Samlet oppsummering');
  }

  let tocPage = 3;
  for (const entry of tocEntries) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.textBody);
    doc.text(entry, M, y);

    // Dotted leader line
    const entryWidth = doc.getTextWidth(entry);
    const pageNumStr = String(tocPage);
    const pageNumWidth = doc.getTextWidth(pageNumStr);
    const dotsStart = M + entryWidth + 3;
    const dotsEnd = PW - M - pageNumWidth - 3;

    doc.setTextColor(...C.textMuted);
    let dx = dotsStart;
    while (dx < dotsEnd) {
      doc.text('.', dx, y);
      dx += 2.5;
    }
    doc.text(pageNumStr, PW - M, y, { align: 'right' });

    y += 9;
    tocPage++;
  }

  drawFooter();

  // ===================================
  // PER-SESSION PAGES
  // ===================================
  for (const session of (data.sessions || [])) {
    doc.addPage();
    pageNum++;
    y = M + 10;
    drawHeader();

    const sChallenges = (data.challenges || []).filter(c => c.sessionId === session.id);
    const sClusters = (data.clusters || []).filter(c => c.sessionId === session.id);
    const sHkv = (data.hkvQuestions || []).filter(h => h.sessionId === session.id && h.isApproved);
    const sIdeas = (data.ideas || []).filter(i => i.sessionId === session.id);
    const sPrioritized = sIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');

    // Session title
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.darkGrey);
    const sessLines = doc.splitTextToSize(s(session.title), CW);
    doc.text(sessLines, M, y);
    y += sessLines.length * 12 + 2;

    // Green underline
    doc.setFillColor(...C.green);
    doc.rect(M, y, 35, 1.5, 'F');
    y += 10;

    // Stats summary
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.midGrey);
    const statsText = `${sChallenges.length} utfordringer   \u00B7   ${sClusters.length} klynger   \u00B7   ${sHkv.length} HKV   \u00B7   ${sIdeas.length} ideer   \u00B7   ${sPrioritized.length} prioritert`;
    doc.text(statsText, M, y);
    y += 12;

    // --- Challenges ---
    if (sChallenges.length > 0) {
      sectionHeading('Utfordringer');

      for (const c of sChallenges) {
        ensureSpace(7);
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.textBody);

        // Bullet
        doc.setFillColor(...C.green);
        doc.circle(M + 2, y - 1.2, 1, 'F');

        const cLines = doc.splitTextToSize(s(c.text), CW - 10);
        doc.text(cLines, M + 7, y);
        y += cLines.length * 4.5 + 1.5;
      }
      y += 6;
    }

    // --- Clusters ---
    if (sClusters.length > 0) {
      sectionHeading('Klynger');

      for (const cl of sClusters) {
        ensureSpace(18);

        // Cluster name with green accent
        subHeading(s(cl.name));

        if (cl.summary) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...C.textMuted);
          const sumLines = doc.splitTextToSize(s(cl.summary), CW - 8);
          doc.text(sumLines, M + 4, y);
          y += sumLines.length * 4.2 + 2;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.textBody);
        for (const ch of (cl.challenges || [])) {
          ensureSpace(6);
          doc.setFillColor(...C.midGrey);
          doc.circle(M + 6, y - 1, 0.7, 'F');
          const chLines = doc.splitTextToSize(s(ch.text), CW - 16);
          doc.text(chLines, M + 10, y);
          y += chLines.length * 4;
        }
        y += 5;
      }
    }

    // --- HKV ---
    if (sHkv.length > 0) {
      sectionHeading('HKV-sporsmaal');

      for (const h of sHkv) {
        quoteBox(s(h.fullText));
      }
      y += 4;
    }

    // --- Prioritized Ideas ---
    if (sPrioritized.length > 0) {
      sectionHeading('Prioriterte ideer');

      for (const idea of sPrioritized) {
        ensureSpace(35);

        // Card background
        const cardStartY = y - 3;

        // Title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.darkGrey);
        doc.text(s(idea.title), M + 6, y + 1);
        y += 7;

        // Description
        if (idea.description) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.textBody);
          const dLines = doc.splitTextToSize(s(idea.description), CW - 14);
          for (const line of dLines) {
            ensureSpace(5);
            doc.text(line, M + 6, y);
            y += 4.2;
          }
          y += 2;
        }

        // Cluster reference
        if (idea.clusterName) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...C.textMuted);
          doc.text('Klynge: ' + s(idea.clusterName), M + 6, y);
          y += 5;
        }

        // Score badges
        if (idea.score) {
          ensureSpace(8);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...C.midGrey);

          const scoreParts = [
            'Nytte: ' + (VALUE_LABELS[idea.score.utilityValue] || idea.score.utilityValue),
            'Gjennomforbarhet: ' + (VALUE_LABELS[idea.score.feasibility] || idea.score.feasibility),
            QUAD_LABELS[idea.score.matrixQuadrant] || idea.score.matrixQuadrant,
          ];
          doc.text(scoreParts.join('   \u00B7   '), M + 6, y);
          y += 6;
        }

        // Canvas
        if (idea.canvas) {
          ensureSpace(20);
          y += 2;

          const canvasFields: [string, string][] = [];
          if (idea.canvas.problemStatement) canvasFields.push(['Problemstilling', s(idea.canvas.problemStatement)]);
          if (idea.canvas.solutionSummary) canvasFields.push(['Losning', s(idea.canvas.solutionSummary)]);
          if (idea.canvas.dataNeeds) canvasFields.push(['Databehov', s(idea.canvas.dataNeeds)]);
          if (idea.canvas.stakeholders) canvasFields.push(['Interessenter', s(idea.canvas.stakeholders)]);
          if (idea.canvas.firstSteps) canvasFields.push(['Forste steg', s(idea.canvas.firstSteps)]);
          if (idea.canvas.expectedOutcome) canvasFields.push(['Forventet effekt', s(idea.canvas.expectedOutcome)]);

          for (const [label, value] of canvasFields) {
            ensureSpace(12);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.green);
            doc.text(label, M + 8, y);
            y += 4;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.textBody);
            const vLines = doc.splitTextToSize(value, CW - 18);
            for (const vl of vLines) {
              ensureSpace(4.5);
              doc.text(vl, M + 8, y);
              y += 4;
            }
            y += 2;
          }
        }

        // Green left border on entire card
        const cardH = y - cardStartY;
        doc.setFillColor(...C.green);
        doc.rect(M, cardStartY, 2, cardH, 'F');

        // Light separator
        y += 3;
        doc.setDrawColor(...C.lightBg);
        doc.setLineWidth(0.3);
        doc.line(M, y, PW - M, y);
        y += 6;
      }
    }

    drawFooter();
  }

  // ===================================
  // COMBINED SUMMARY (if multiple sessions)
  // ===================================
  if ((data.sessions || []).length > 1) {
    doc.addPage();
    pageNum++;
    y = M + 10;
    drawHeader();

    // Title
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.darkGrey);
    doc.text('Samlet oppsummering', M, y);
    y += 5;
    doc.setFillColor(...C.green);
    doc.rect(M, y, 35, 1.5, 'F');
    y += 15;

    // Per-session stats table
    const tableBody = data.sessions.map(sess => {
      const sc = (data.challenges || []).filter(c => c.sessionId === sess.id);
      const scl = (data.clusters || []).filter(c => c.sessionId === sess.id);
      const si = (data.ideas || []).filter(i => i.sessionId === sess.id);
      const sp = si.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');
      return [s(sess.title), String(sc.length), String(scl.length), String(si.length), String(sp.length)];
    });

    autoTable(doc, {
      startY: y,
      head: [['Okt', 'Utfordringer', 'Klynger', 'Ideer', 'Prioritert']],
      body: tableBody,
      theme: 'plain',
      headStyles: {
        fillColor: C.green,
        textColor: C.white,
        fontSize: 9,
        font: 'helvetica',
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: C.textBody,
        cellPadding: 3.5,
      },
      alternateRowStyles: { fillColor: C.lightBg },
      margin: { left: M, right: M },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 12;

    // All prioritized ideas table
    const allPrioritized = (data.ideas || []).filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');
    if (allPrioritized.length > 0) {
      sectionHeading('Alle prioriterte ideer');

      const ideaTableBody = allPrioritized.map(i => {
        const sessionTitle = data.sessions.find(sess => sess.id === i.sessionId)?.title || '';
        return [
          s(i.title),
          s(sessionTitle),
          s(i.clusterName),
          VALUE_LABELS[i.score?.utilityValue || ''] || '',
          VALUE_LABELS[i.score?.feasibility || ''] || '',
          QUAD_LABELS[i.score?.matrixQuadrant || ''] || '',
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Ide', 'Okt', 'Klynge', 'Nytte', 'Gjennomf.', 'Kvadrant']],
        body: ideaTableBody,
        theme: 'plain',
        headStyles: {
          fillColor: C.green,
          textColor: C.white,
          fontSize: 8.5,
          font: 'helvetica',
          fontStyle: 'bold',
          cellPadding: 3.5,
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: C.textBody,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 42 },
          1: { cellWidth: 25 },
          2: { cellWidth: 28 },
        },
        alternateRowStyles: { fillColor: C.lightBg },
        margin: { left: M, right: M },
        tableLineColor: [220, 220, 220],
        tableLineWidth: 0.2,
      });
    }

    drawFooter();
  }

  // ===================================
  // DOWNLOAD
  // ===================================
  const safeName = (data.workshop.title || 'rapport').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  doc.save(safeName + '_rapport.pdf');
}
