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

const COLORS = {
  ateaGreen: [0, 138, 0] as [number, number, number],
  ateaGrey: [77, 87, 93] as [number, number, number],
  lightGrey: [237, 238, 238] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  textSecondary: [107, 114, 128] as [number, number, number],
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

const PAGE_W = 210;
const MARGIN = 20;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// Safe string — ensure we never pass null/undefined to jsPDF text methods
function s(val: unknown): string {
  if (val == null) return '';
  return String(val);
}

export function generateReport(data: ReportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > 277) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const drawFooter = (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textSecondary);
    doc.text('Design Sprint Light  |  ' + s(data.workshop.title), MARGIN, 290);
    doc.text('Side ' + pageNum, PAGE_W - MARGIN, 290, { align: 'right' });
  };

  // ===================================
  // PAGE 1: COVER
  // ===================================
  doc.setFillColor(...COLORS.ateaGreen);
  doc.rect(0, 0, PAGE_W, 6, 'F');

  // Logo
  doc.setFillColor(...COLORS.ateaGrey);
  doc.roundedRect(MARGIN, 35, 16, 16, 3, 3, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DS', MARGIN + 8, 45, { align: 'center' });

  doc.setTextColor(...COLORS.ateaGrey);
  doc.setFontSize(14);
  doc.text('Design Sprint Light', MARGIN + 20, 45);

  // Title
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  const titleLines = doc.splitTextToSize(s(data.workshop.title), CONTENT_W);
  doc.text(titleLines, MARGIN, 80);

  let coverY = 80 + titleLines.length * 12;

  if (data.workshop.description) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.textSecondary);
    const descLines = doc.splitTextToSize(s(data.workshop.description), CONTENT_W);
    doc.text(descLines, MARGIN, coverY + 5);
    coverY += 5 + descLines.length * 6;
  }

  // Green separator
  coverY += 10;
  doc.setDrawColor(...COLORS.ateaGreen);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, coverY, MARGIN + 40, coverY);
  coverY += 15;

  // Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.ateaGrey);

  const metaItems: [string, string][] = [];
  if (data.workshop.customerName) metaItems.push(['Kunde', s(data.workshop.customerName)]);
  metaItems.push(['Fasilitator', s(data.workshop.facilitatorName)]);
  try {
    metaItems.push(['Dato', new Date(data.workshop.createdAt).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })]);
  } catch {
    metaItems.push(['Dato', s(data.workshop.createdAt)]);
  }
  metaItems.push(['Antall okter', String(data.sessions?.length || 0)]);
  metaItems.push(['Totalt utfordringer', String(data.challenges?.length || 0)]);
  metaItems.push(['Totalt ideer', String(data.ideas?.length || 0)]);
  metaItems.push(['Prioriterte ideer', String((data.ideas || []).filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').length)]);

  for (const [label, value] of metaItems) {
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', MARGIN, coverY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, MARGIN + 40, coverY);
    coverY += 7;
  }

  // ===================================
  // PER-SESSION PAGES
  // ===================================
  let pageNum = 1;

  for (const session of (data.sessions || [])) {
    doc.addPage();
    pageNum++;
    y = MARGIN;

    const sChallenges = (data.challenges || []).filter(c => c.sessionId === session.id);
    const sClusters = (data.clusters || []).filter(c => c.sessionId === session.id);
    const sHkv = (data.hkvQuestions || []).filter(h => h.sessionId === session.id && h.isApproved);
    const sIdeas = (data.ideas || []).filter(i => i.sessionId === session.id);
    const sPrioritized = sIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');

    // Session header
    doc.setFillColor(...COLORS.ateaGreen);
    doc.rect(0, 0, PAGE_W, 3, 'F');

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text(s(session.title), MARGIN, y + 5);
    y += 12;

    // Stats bar
    doc.setFillColor(...COLORS.lightGrey);
    doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ateaGrey);
    const stats = sChallenges.length + ' utfordringer   |   ' + sClusters.length + ' klynger   |   ' + sHkv.length + ' HKV   |   ' + sIdeas.length + ' ideer   |   ' + sPrioritized.length + ' prioritert';
    doc.text(stats, PAGE_W / 2, y + 7.5, { align: 'center' });
    y += 18;

    // --- Challenges ---
    if (sChallenges.length > 0) {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ateaGreen);
      doc.text('Utfordringer', MARGIN, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.ateaGrey);

      for (const c of sChallenges) {
        ensureSpace(8);
        const lines = doc.splitTextToSize('-  ' + s(c.text), CONTENT_W - 4);
        doc.text(lines, MARGIN + 2, y);
        y += lines.length * 4.5;
      }
      y += 5;
    }

    // --- Clusters ---
    if (sClusters.length > 0) {
      ensureSpace(15);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ateaGreen);
      doc.text('Klynger', MARGIN, y);
      y += 7;

      for (const cl of sClusters) {
        ensureSpace(15);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.black);
        doc.text(s(cl.name), MARGIN + 2, y);
        y += 5;

        if (cl.summary) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...COLORS.textSecondary);
          const sumLines = doc.splitTextToSize(s(cl.summary), CONTENT_W - 8);
          doc.text(sumLines, MARGIN + 4, y);
          y += sumLines.length * 4;
        }

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.ateaGrey);
        for (const ch of (cl.challenges || [])) {
          ensureSpace(6);
          const lines = doc.splitTextToSize('- ' + s(ch.text), CONTENT_W - 10);
          doc.text(lines, MARGIN + 6, y);
          y += lines.length * 4;
        }
        y += 4;
      }
    }

    // --- HKV ---
    if (sHkv.length > 0) {
      ensureSpace(15);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ateaGreen);
      doc.text('HKV-sporsmaal', MARGIN, y);
      y += 7;

      for (const h of sHkv) {
        ensureSpace(12);
        doc.setFillColor(230, 245, 230);
        const hLines = doc.splitTextToSize(s(h.fullText), CONTENT_W - 12);
        const hHeight = hLines.length * 5 + 4;
        doc.roundedRect(MARGIN, y - 3, CONTENT_W, hHeight, 1.5, 1.5, 'F');

        doc.setDrawColor(...COLORS.ateaGreen);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, y - 3, MARGIN, y - 3 + hHeight);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.black);
        doc.text(hLines, MARGIN + 4, y + 1);
        y += hHeight + 4;
      }
    }

    // --- Prioritized Ideas ---
    if (sPrioritized.length > 0) {
      ensureSpace(15);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ateaGreen);
      doc.text('Prioriterte ideer (' + sPrioritized.length + ')', MARGIN, y);
      y += 8;

      for (const idea of sPrioritized) {
        ensureSpace(30);
        const startY = y - 2;

        // Title
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.black);
        doc.text(s(idea.title), MARGIN + 4, y + 2);
        y += 7;

        // Description
        if (idea.description) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.ateaGrey);
          const dLines = doc.splitTextToSize(s(idea.description), CONTENT_W - 12);
          doc.text(dLines, MARGIN + 4, y);
          y += dLines.length * 4 + 2;
        }

        // HKV reference
        if (idea.hkvText) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...COLORS.textSecondary);
          const hkvRef = doc.splitTextToSize('HKV: ' + s(idea.hkvText), CONTENT_W - 12);
          doc.text(hkvRef, MARGIN + 4, y);
          y += hkvRef.length * 3.5 + 2;
        }

        // Score
        if (idea.score) {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.ateaGrey);
          const scoreText = 'Nytte: ' + (VALUE_LABELS[idea.score.utilityValue] || idea.score.utilityValue) +
            '  |  Gjennomforbarhet: ' + (VALUE_LABELS[idea.score.feasibility] || idea.score.feasibility) +
            '  |  ' + (QUAD_LABELS[idea.score.matrixQuadrant] || idea.score.matrixQuadrant);
          doc.text(scoreText, MARGIN + 4, y);
          y += 6;
        }

        // Canvas
        if (idea.canvas) {
          ensureSpace(30);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...COLORS.ateaGreen);
          doc.text('Idecanvas:', MARGIN + 4, y);
          y += 5;

          const canvasFields: [string, string][] = [];
          if (idea.canvas.problemStatement) canvasFields.push(['Problemstilling', s(idea.canvas.problemStatement)]);
          if (idea.canvas.solutionSummary) canvasFields.push(['Losning', s(idea.canvas.solutionSummary)]);
          if (idea.canvas.dataNeeds) canvasFields.push(['Databehov', s(idea.canvas.dataNeeds)]);
          if (idea.canvas.stakeholders) canvasFields.push(['Interessenter', s(idea.canvas.stakeholders)]);
          if (idea.canvas.firstSteps) canvasFields.push(['Forste steg', s(idea.canvas.firstSteps)]);
          if (idea.canvas.expectedOutcome) canvasFields.push(['Forventet effekt', s(idea.canvas.expectedOutcome)]);

          for (const [label, value] of canvasFields) {
            ensureSpace(10);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.ateaGrey);
            doc.text(label + ':', MARGIN + 6, y);
            y += 4;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.black);
            const vLines = doc.splitTextToSize(value, CONTENT_W - 16);
            doc.text(vLines, MARGIN + 6, y);
            y += vLines.length * 3.8 + 2;
          }
        }

        // Left border on idea card
        const cardH = y - startY + 2;
        doc.setDrawColor(...COLORS.ateaGreen);
        doc.setLineWidth(1);
        doc.line(MARGIN, startY, MARGIN, startY + cardH);

        y += 6;
      }
    }

    drawFooter(pageNum);
  }

  // ===================================
  // COMBINED SUMMARY (if multiple sessions)
  // ===================================
  if ((data.sessions || []).length > 1) {
    doc.addPage();
    pageNum++;
    y = MARGIN;

    doc.setFillColor(...COLORS.ateaGreen);
    doc.rect(0, 0, PAGE_W, 3, 'F');

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('Samlet oppsummering', MARGIN, y + 5);
    y += 15;

    // Per-session stats table using autoTable function API
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
      theme: 'grid',
      headStyles: { fillColor: COLORS.ateaGreen, textColor: COLORS.white, fontSize: 9, font: 'helvetica', fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, textColor: COLORS.ateaGrey },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: MARGIN, right: MARGIN },
    });

    // Get the Y position after the table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 10;

    // All prioritized ideas
    const allPrioritized = (data.ideas || []).filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');
    if (allPrioritized.length > 0) {
      ensureSpace(15);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.ateaGreen);
      doc.text('Alle prioriterte ideer (' + allPrioritized.length + ')', MARGIN, y);
      y += 7;

      const ideaTableBody = allPrioritized.map(i => {
        const sessionTitle = data.sessions.find(sess => sess.id === i.sessionId)?.title || '';
        return [
          s(i.title),
          s(sessionTitle),
          VALUE_LABELS[i.score?.utilityValue || ''] || '',
          VALUE_LABELS[i.score?.feasibility || ''] || '',
          QUAD_LABELS[i.score?.matrixQuadrant || ''] || '',
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Ide', 'Okt', 'Nytte', 'Gjennomf.', 'Kvadrant']],
        body: ideaTableBody,
        theme: 'grid',
        headStyles: { fillColor: COLORS.ateaGreen, textColor: COLORS.white, fontSize: 8.5, font: 'helvetica', fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, textColor: COLORS.ateaGrey },
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 30 } },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: MARGIN, right: MARGIN },
      });
    }

    drawFooter(pageNum);
  }

  // ===================================
  // DOWNLOAD
  // ===================================
  const safeName = (data.workshop.title || 'rapport').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  doc.save(safeName + '_rapport.pdf');
}
