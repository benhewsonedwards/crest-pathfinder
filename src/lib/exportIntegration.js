/**
 * CREST Pathfinder — Integration Spec Export (browser, lazy-loaded)
 * Call exportIntegrationSpec(data) to generate and download a .docx file.
 * The docx library is loaded on demand so it doesn't bloat the initial bundle.
 */

// ─── Colours ──────────────────────────────────────────────────────────────────
const PURPLE   = "6559FF";
const PURPLE_L = "EEF0FF";
const GREEN    = "16A34A";
const GREEN_L  = "DCFCE7";
const AMBER    = "D97706";
const RED      = "DC2626";
const RED_L    = "FEE2E2";
const GREY_BG  = "F8F9FC";
const BORDER_C = "E4E7EF";
const TEXT     = "111827";
const MUTED    = "6B7280";

function statusColour(s) {
  return { scoping: PURPLE, "in-build": "8B5CF6", testing: "EA580C", live: GREEN, "live-attention": AMBER, broken: RED, decommissioned: MUTED }[s] || MUTED;
}
function statusLabel(s) {
  return { scoping: "Scoping", "in-build": "In Build", testing: "Testing", live: "Live", "live-attention": "Live — Needs Attention", broken: "Broken", decommissioned: "Decommissioned" }[s] || (s || "—");
}
function ticketTypeLabel(t) {
  return { initial: "Initial CSR", "bug-fix": "Bug Fix", enhancement: "Enhancement", "config-change": "Configuration Change", monitoring: "Monitoring" }[t] || (t || "—");
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function exportIntegrationSpec(data) {
  // Dynamic import — only loads docx when needed
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
    ShadingType,
  } = await import("docx");

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const stColour = statusColour(data.status);
  const stLabel  = statusLabel(data.status);
  const safeFilename = (data.name || "Integration").replace(/[^a-zA-Z0-9\s\-_→]/g, "").trim();

  // Borders / margins
  const stdB  = { style: BorderStyle.SINGLE, size: 1, color: BORDER_C };
  const cBord = { top: stdB, bottom: stdB, left: stdB, right: stdB };
  const cMarg = { top: 80, bottom: 80, left: 160, right: 160 };
  const cMargS= { top: 60, bottom: 60, left: 120, right: 120 };

  // ── Helpers ──
  const h1 = text => new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PURPLE, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 36, font: "Arial", color: TEXT })],
  });
  const h2 = text => new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 },
    children: [new TextRun({ text, bold: true, size: 26, font: "Arial", color: PURPLE })],
  });
  const bodyP = text => !text ? null : new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: String(text), size: 22, font: "Arial", color: TEXT })],
  });
  const sp = () => new Paragraph({ spacing: { after: 100 } });
  const divider = () => new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_C, space: 1 } },
  });
  const badge = (text, colour = PURPLE) => {
    const bg = { [GREEN]: GREEN_L, [RED]: RED_L }[colour] || PURPLE_L;
    return new Paragraph({
      spacing: { before: 180, after: 80 },
      shading: { fill: bg, type: ShadingType.CLEAR },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: colour, space: 4 } },
      children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: colour })],
    });
  };

  // KV table helpers
  const kvRow = (label, value) => new TableRow({ children: [
    new TableCell({ width: { size: 2800, type: WidthType.DXA }, borders: cBord, shading: { fill: GREY_BG, type: ShadingType.CLEAR }, margins: cMarg,
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial", color: MUTED })] })] }),
    new TableCell({ width: { size: 6560, type: WidthType.DXA }, borders: cBord, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cMarg,
      children: [new Paragraph({ children: [new TextRun({ text: String(value || "—"), size: 20, font: "Arial", color: TEXT })] })] }),
  ]});
  const kvTable = rows => new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 6560], rows: rows.filter(Boolean) });

  // Effort table
  const effortTable = () => {
    const phases = [["Scoping", data.scopingHours], ["Development", data.devHours], ["Testing", data.testingHours], ["UAT", data.uatHours]].filter(([, v]) => v);
    if (!phases.length) return null;
    const total = phases.reduce((s, [, v]) => s + (Number(v) || 0), 0);
    const hdrCell = (text, w) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: cBord, shading: { fill: PURPLE, type: ShadingType.CLEAR }, margins: cMarg,
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })] });
    const valCell = (text, w, bg = "FFFFFF", colour = TEXT, bold = false) => new TableCell({ width: { size: w, type: WidthType.DXA }, borders: cBord, shading: { fill: bg, type: ShadingType.CLEAR }, margins: cMargS,
      children: [new Paragraph({ alignment: w === 4320 ? AlignmentType.CENTER : undefined, children: [new TextRun({ text: String(text), size: 20, font: "Arial", color: colour, bold })] })] });
    return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [5040, 4320], rows: [
      new TableRow({ tableHeader: true, children: [hdrCell("Phase", 5040), hdrCell("Estimated Hours", 4320)] }),
      ...phases.map(([l, h]) => new TableRow({ children: [valCell(l, 5040), valCell(`${h}h`, 4320)] })),
      new TableRow({ children: [valCell("Total", 5040, GREY_BG, TEXT, true), valCell(`${total}h`, 4320, GREY_BG, PURPLE, true)] }),
    ]});
  };

  // Tickets table
  const ticketsTable = () => {
    const tickets = data.tickets || [];
    if (!tickets.length) return null;
    const W = [1800, 1400, 4360, 1800];
    const hdrRow = new TableRow({ tableHeader: true, children: ["Type","Jira Key","Description","Status"].map((h, i) =>
      new TableCell({ width: { size: W[i], type: WidthType.DXA }, borders: cBord, shading: { fill: PURPLE, type: ShadingType.CLEAR }, margins: cMargS,
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] })
    )});
    return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: W, rows: [hdrRow,
      ...tickets.map(t => new TableRow({ children: [
        new TableCell({ width: { size: W[0], type: WidthType.DXA }, borders: cBord, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ children: [new TextRun({ text: ticketTypeLabel(t.type), size: 18, font: "Arial" })] })] }),
        new TableCell({ width: { size: W[1], type: WidthType.DXA }, borders: cBord, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ children: [new TextRun({ text: t.jiraKey || "—", size: 18, font: "Arial", color: t.jiraKey ? PURPLE : MUTED, bold: !!t.jiraKey })] })] }),
        new TableCell({ width: { size: W[2], type: WidthType.DXA }, borders: cBord, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ children: [new TextRun({ text: t.description || "—", size: 18, font: "Arial" })] })] }),
        new TableCell({ width: { size: W[3], type: WidthType.DXA }, borders: cBord, shading: { fill: t.status === "done" ? GREEN_L : "FFFFFF", type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ children: [new TextRun({ text: t.status || "open", size: 18, font: "Arial", color: t.status === "done" ? GREEN : TEXT })] })] }),
      ]}))
    ]});
  };

  // Version history table
  const versionsTable = () => {
    const versions = data.versionHistory || [];
    if (!versions.length) return null;
    const W = [1600, 1000, 5160, 1600];
    const hdrRow = new TableRow({ tableHeader: true, children: ["Date","Version","Description / Changes","Author"].map((h, i) =>
      new TableCell({ width: { size: W[i], type: WidthType.DXA }, borders: cBord, shading: { fill: PURPLE, type: ShadingType.CLEAR }, margins: cMargS,
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, font: "Arial", color: "FFFFFF" })] })] })
    )});
    return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: W, rows: [hdrRow,
      ...[...versions].reverse().map(v => new TableRow({ children: [
        new TableCell({ width: { size: W[0], type: WidthType.DXA }, borders: cBord, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ children: [new TextRun({ text: v.date || "—", size: 18, font: "Arial", color: MUTED })] })] }),
        new TableCell({ width: { size: W[1], type: WidthType.DXA }, borders: cBord, shading: { fill: PURPLE_L, type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v.version || "—", bold: true, size: 18, font: "Arial", color: PURPLE })] })] }),
        new TableCell({ width: { size: W[2], type: WidthType.DXA }, borders: cBord, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ children: [new TextRun({ text: v.description || "—", size: 18, font: "Arial" })] })] }),
        new TableCell({ width: { size: W[3], type: WidthType.DXA }, borders: cBord, shading: { fill: "FFFFFF", type: ShadingType.CLEAR }, margins: cMargS, children: [new Paragraph({ children: [new TextRun({ text: v.author || "—", size: 18, font: "Arial", color: MUTED })] })] }),
      ]}))
    ]});
  };

  // ── Assemble document ──────────────────────────────────────────────────────
  const children = [
    sp(), sp(),
    new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "INTEGRATION SPECIFICATION", size: 20, font: "Arial", color: MUTED, bold: true, allCaps: true })] }),
    new Paragraph({ spacing: { before: 80, after: 200 }, children: [new TextRun({ text: data.name || "Integration Spec", bold: true, size: 52, font: "Arial", color: TEXT })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Customer:  ", bold: true, size: 24, font: "Arial", color: MUTED }), new TextRun({ text: data.customerName || "—", size: 24, font: "Arial", color: TEXT })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Status:  ", bold: true, size: 24, font: "Arial", color: MUTED }), new TextRun({ text: stLabel, bold: true, size: 24, font: "Arial", color: stColour })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Built by:  ", bold: true, size: 24, font: "Arial", color: MUTED }), new TextRun({ text: data.cseBuiltBy || "—", size: 24, font: "Arial", color: TEXT })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Exported:  ", bold: true, size: 24, font: "Arial", color: MUTED }), new TextRun({ text: today, size: 24, font: "Arial", color: TEXT })] }),
    divider(),

    h1("1. Overview"),
    kvTable([
      kvRow("Integration name",    data.name),
      kvRow("Category",            data.category),
      kvRow("Status",              stLabel),
      kvRow("Customer",            data.customerName),
      kvRow("Built by (CSE)",      data.cseBuiltBy),
      kvRow("Source system",       data.sourceSystem),
      kvRow("Target system",       data.targetSystem),
      kvRow("Data direction",      data.dataDirection),
      kvRow("Trigger type",        data.triggerType),
      kvRow("Run frequency",       data.runFrequency),
      kvRow("Go-live date",        data.proposedGoLiveDate),
      kvRow("Workato environment", data.workatoEnv),
      kvRow("Recipe URL",          data.workatoRecipeUrl),
      kvRow("SC Org Role ID",      data.scOrgRoleId || data.accountRoleId),
    ]),
    sp(),
    data.problemStatement && h2("Problem Statement"),
    data.problemStatement && bodyP(data.problemStatement),
    data.desiredOutcome && h2("Desired Outcome"),
    data.desiredOutcome && bodyP(data.desiredOutcome),
    divider(),

    h1("2. Scoping"),
    kvTable([
      kvRow("Business impact", data.businessImpact),
      kvRow("Feasibility",     data.feasibility ? data.feasibility.charAt(0).toUpperCase() + data.feasibility.slice(1) : "—"),
      kvRow("ROI / value",     data.roi),
    ]),
    data.businessImpactExplanation && bodyP(data.businessImpactExplanation),
    sp(),
    ...[
      ["mustHave", "Must Have", GREEN],
      ["shouldHave", "Should Have", PURPLE],
      ["couldHave", "Could Have", PURPLE],
      ["cantHave", "Can't Have / Out of Scope", RED],
    ].flatMap(([key, label, colour]) => data[key] ? [badge(label, colour), bodyP(data[key]), sp()] : []),
    data.nfRequirements && h2("Non-Functional Requirements"),
    data.nfRequirements && bodyP(data.nfRequirements),
    data.assumptions && h2("Assumptions"),
    data.assumptions && bodyP(data.assumptions),
    data.risks && h2("Risks"),
    data.risks && bodyP(data.risks),
    sp(), h2("Effort Estimate"), effortTable(),
    divider(),

    h1("3. Integration Design"),
    data.highLevelArchitecture && h2("Architecture"),
    data.highLevelArchitecture && bodyP(data.highLevelArchitecture),
    kvTable([
      kvRow("Trigger event",         data.triggerEvent),
      kvRow("Data transformation",   data.dataTransformation),
      kvRow("Source API calls",      data.sourceApiCalls),
      kvRow("Destination API calls", data.destinationApiCalls),
    ]),
    data.integrationSteps && h2("Integration Steps"),
    data.integrationSteps && bodyP(data.integrationSteps),
    data.fieldMapping && h2("Field Mapping"),
    data.fieldMapping && bodyP(data.fieldMapping),
    data.successCriteria && h2("Success Criteria"),
    data.successCriteria && bodyP(data.successCriteria),
    h2("Error Handling"),
    kvTable([
      kvRow("Logging mechanism",    data.loggingMechanism || "Workato logs"),
      kvRow("Retry logic",          data.retryLogic),
      kvRow("Failure notification", data.failureNotification),
    ]),
    divider(),

    h1("4. Operational Details"),
    kvTable([
      kvRow("Workato environment", data.workatoEnv),
      kvRow("Recipe URL",          data.workatoRecipeUrl),
      kvRow("Recipe folder",       data.workatoRecipeFolder),
      kvRow("SC Org Role ID",      data.scOrgRoleId || data.accountRoleId),
      kvRow("Middleware",          data.middleware),
      kvRow("Sensitive data",      data.sensitiveData),
    ]),
    data.knownChallenges && h2("Known Challenges / Limitations"),
    data.knownChallenges && bodyP(data.knownChallenges),
    data.operationalNotes && h2("Operational Notes"),
    data.operationalNotes && bodyP(data.operationalNotes),
    divider(),

    h1("5. Tickets & Change History"),
    ticketsTable() || new Paragraph({ children: [new TextRun({ text: "No tickets logged.", size: 20, font: "Arial", color: MUTED, italics: true })] }),
    divider(),

    h1("6. Version History"),
    versionsTable() || new Paragraph({ children: [new TextRun({ text: "No version history.", size: 20, font: "Arial", color: MUTED, italics: true })] }),
  ].flat().filter(Boolean);

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22, color: TEXT } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: TEXT },
          paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: PURPLE },
          paragraph: { spacing: { before: 260, after: 100 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PURPLE, space: 6 } },
          children: [
            new TextRun({ text: "CREST Pathfinder  ·  Integration Specification  ·  ", size: 18, font: "Arial", color: MUTED }),
            new TextRun({ text: data.name || "Integration", bold: true, size: 18, font: "Arial", color: TEXT }),
            new TextRun({ text: `  ·  ${data.customerName || ""}`, size: 18, font: "Arial", color: MUTED }),
          ],
        })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_C, space: 4 } },
          children: [new TextRun({ text: "CONFIDENTIAL  ·  SafetyCulture Customer Success Engineering", size: 16, font: "Arial", color: MUTED })],
        })] }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename} — ${data.customerName || "Integration"} Spec.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
