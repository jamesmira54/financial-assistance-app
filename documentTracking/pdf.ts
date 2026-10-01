import PDFDocument from "pdfkit";
import { DocumentTrackResponse } from "./service";

// Renders a submitted track and its persisted history as an official-record
// PDF. Input is the service response built from the database, never client
// state.

const MARGIN = 40;
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_PROCESSED: "In-Processed",
  FORWARDED: "Forwarded",
  RETURNED: "Returned",
  DONE: "Done",
};
const ACTION_LABEL: Record<string, string> = {
  CREATED: "Created",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted / In-Processed",
  FORWARDED: "Forwarded",
  RETURNED: "Returned",
  DONE: "Done",
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// History table columns; widths sum to the printable width of an A4 landscape
// page (842 - 2 * MARGIN).
const COLUMNS = [
  { key: "at", label: "Date/Time", width: 95 },
  { key: "action", label: "Action", width: 95 },
  { key: "from", label: "From", width: 100 },
  { key: "to", label: "To", width: 100 },
  { key: "actor", label: "Actor", width: 110 },
  { key: "status", label: "Status", width: 70 },
  { key: "remarks", label: "Remarks", width: 192 },
];

export const renderTrackPdf = (track: DocumentTrackResponse): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: MARGIN,
      bufferPages: true,
      info: { Title: `${track.trackNumber} Document Tracking`, Author: "FINAS System" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - MARGIN * 2;

    // Header
    doc.font("Helvetica-Bold").fontSize(16).text("FINAS SYSTEM", { align: "center" });
    doc.fontSize(12).text("DOCUMENT TRACKING SYSTEM", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Track No.: ${track.trackNumber}`, { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + width, doc.y).stroke();
    doc.moveDown(0.5);

    // Track information, two label/value columns.
    const info: [string, string][] = [
      ["Document", track.title],
      ["Particulars", track.particulars],
      ["Process Type", track.processType ?? "—"],
      ["Purpose", track.purpose ?? "—"],
      ["Sponsorship", track.sponsorshipName ?? "—"],
      ["Created By", track.createdBy?.name ?? track.originOffice ?? "—"],
      ["Created At", formatDate(track.createdAt)],
      ["Submitted At", formatDate(track.submittedAt)],
      ["Current Status", STATUS_LABEL[track.status] ?? track.status],
      ["Current Office", track.currentHolder ?? "—"],
    ];
    if (track.completedAt) info.push(["Completed At", formatDate(track.completedAt)]);

    for (const [label, value] of info) {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(10).text(`${label}:`, MARGIN, y, { width: 110 });
      doc.font("Helvetica").text(value || "—", MARGIN + 115, y, { width: width - 115 });
      doc.moveDown(0.3);
    }

    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).text("TRACKING HISTORY", MARGIN);
    doc.moveDown(0.4);

    const drawRow = (cells: string[], bold: boolean) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
      const heights = cells.map((c, i) => doc.heightOfString(c || "—", { width: COLUMNS[i].width - 6 }));
      const rowHeight = Math.max(...heights) + 8;
      if (doc.y + rowHeight > doc.page.height - MARGIN - 20) {
        doc.addPage();
      }
      const top = doc.y;
      let x = MARGIN;
      cells.forEach((c, i) => {
        doc.rect(x, top, COLUMNS[i].width, rowHeight).stroke();
        doc.text(c || "—", x + 3, top + 4, { width: COLUMNS[i].width - 6 });
        x += COLUMNS[i].width;
      });
      doc.y = top + rowHeight;
      doc.x = MARGIN;
    };

    drawRow(COLUMNS.map((c) => c.label), true);
    for (const h of track.history ?? []) {
      drawRow(
        [
          formatDate(h.at),
          ACTION_LABEL[h.action] ?? h.action,
          h.fromOffice || "—",
          h.toOffice || "—",
          !h.actor ? "—" : h.actor.office ? `${h.actor.name} (${h.actor.office})` : h.actor.name,
          STATUS_LABEL[h.status] ?? h.status,
          h.remarks ?? "—",
        ],
        false,
      );
    }

    // Footer on every page: generation time + page numbers.
    const generated = `Generated ${formatDate(new Date().toISOString())}`;
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Writing inside the bottom margin would otherwise trigger a new page.
      doc.page.margins.bottom = 0;
      const y = doc.page.height - MARGIN + 10;
      doc.font("Helvetica").fontSize(8);
      doc.text(generated, MARGIN, y, { width: width / 2, lineBreak: false });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN + width / 2, y, {
        width: width / 2,
        align: "right",
        lineBreak: false,
      });
    }

    doc.end();
  });
