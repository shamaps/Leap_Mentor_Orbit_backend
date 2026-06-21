// backend/utils/generateInvoice.js
const PDFDocument = require("pdfkit");
const path = require("node:path");
const fs = require("node:fs");
const { formatDateShort } = require("./emailHelpers");
/**
 * Generates a LeapMentor invoice PDF buffer.
 *
 * Required fields in `data`:
 *   invoiceNumber, menteeName, menteeEmail, mentorName, mentorEmail,
 *   selectedSlots | confirmedSlot, sessionRate, sessionCount, paidAt
 *
 * Payment fields:
 *   platformFeePercent  — commission rate (MUST match what the modal used, e.g. 20)
 *
 * How the math works (mirrors EscrowPaymentModal exactly):
 *   baseAmount   = sessionRate × sessionCount
 *   platformFee  = ceil(baseAmount × feePercent / 100)
 *   mentorGets   = baseAmount
 *   escrowTotal  = baseAmount + platformFee
 *
 * Optional:
 *   logoPath — absolute path to logo image (PNG/JPEG natively supported by pdfkit)
 */
const generateInvoice = (data) => {
  return new Promise((resolve, reject) => {
    try {
      const {
        invoiceNumber,
        menteeName,
        menteeEmail,
        mentorName,
        mentorEmail,
        selectedSlots,
        confirmedSlot,
        sessionRate,
        sessionCount,
        platformFeePercent,   // ← passed from backend (commissionRate from DB)
        paidAt,
        logoPath: customLogoPath,
      } = data;

      // ── Payment math (mirrors EscrowPaymentModal.jsx exactly) ─
      const rate = Number(sessionRate) || 0;
      const count = Number(sessionCount) || 1;
      const feePercent = Number(platformFeePercent) || 20; // default matches modal default

      const baseAmount = rate * count;                              // 10 × 1 = 10
      const feeTokens = Math.ceil((baseAmount * feePercent) / 100); // ceil(10×20/100) = 2
      const mentorGets = baseAmount;                                // mentor gets full base
      const escrowTotal = baseAmount + feeTokens;                    // 10 + 2 = 12

      // ── Slots ─────────────────────────────────────────────────
      let slots;
      if (Array.isArray(selectedSlots) && selectedSlots.length > 0) {
        slots = selectedSlots;
      } else if (confirmedSlot) {
        slots = [confirmedSlot];
      } else {
        slots = [];
      }

      // ── PDF setup ─────────────────────────────────────────────
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers = [];
      doc.on("data", (c) => buffers.push(c));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // ── Colour palette ────────────────────────────────────────
      const C = {
        brand: "#1E3A8A",
        brandMid: "#1D4ED8",
        slate900: "#0F172A",
        slate700: "#334155",
        slate500: "#64748B",
        slate400: "#94A3B8",
        slate200: "#E2E8F0",
        slate100: "#F1F5F9",
        amber: "#D97706",
        green: "#16A34A",
        escrowBg: "#EFF6FF",
        white: "#FFFFFF",
      };

      // ── Helpers ───────────────────────────────────────────────
      const fmt12 = (t) => {
        if (!t) return "";
        const [h, m] = t.split(":").map(Number);
        const ap = h >= 12 ? "PM" : "AM";
        const hr = h % 12 || 12;
        return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;
      };

      
      const paidDate = paidAt ? formatDateShort(paidAt.toISOString().slice(0, 10)) : "—";

      // ── Layout constants ──────────────────────────────────────
      const L = 50;
      const R = 545;
      const W = 495;
      const HEADER_H = 78;
      const COL_W = 110;
      const LINE_SM = 16;
      const LINE_MD = 20;

      // ═════════════════════════════════════════════════════════
      // HEADER
      // ═════════════════════════════════════════════════════════
      doc.rect(0, 0, doc.page.width, HEADER_H).fill(C.brand);

      const logoPath = customLogoPath || path.resolve("public/images/logo.webp");
      const LOGO_SIZE = 40;
      const LOGO_X = L;
      const LOGO_Y = (HEADER_H - LOGO_SIZE) / 2;
      let logoLoaded = false;

      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, LOGO_X, LOGO_Y, { width: LOGO_SIZE, height: LOGO_SIZE });
          logoLoaded = true;
        } catch (logoErr) {
          logger.warn("Logo image could not be loaded", { error: logoErr.message });
        }
      }
      const textX = logoLoaded ? LOGO_X + LOGO_SIZE + 10 : L;
      doc
        .fillColor(C.white)
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("LeapMentor", textX, (HEADER_H - 24) / 2 + 2);

      // ═════════════════════════════════════════════════════════
      // INVOICE TITLE
      // ═════════════════════════════════════════════════════════
      let y = HEADER_H + 28;

      doc
        .fillColor(C.brandMid)
        .fontSize(26)
        .font("Helvetica-Bold")
        .text("INVOICE", L, y);

      doc.rect(L, y + 33, 72, 3).fill(C.brandMid);

      y += 43;
      doc
        .fillColor(C.slate500)
        .fontSize(9.5)
        .font("Helvetica")
        .text(`Invoice No:   ${invoiceNumber}`, L, y)
        .text(`Date Issued:  ${paidDate}`, L, y + 14);

      y += 40;
      doc.rect(L, y, W, 0.8).fill(C.slate200);

      // ═════════════════════════════════════════════════════════
      // BILLED TO / SESSION WITH
      // ═════════════════════════════════════════════════════════
      y += 18;
      const col2X = 310;

      doc.fillColor(C.slate400).fontSize(8).font("Helvetica-Bold")
        .text("BILLED TO", L, y)
        .text("SESSION WITH", col2X, y);

      y += 13;
      doc.fillColor(C.slate900).fontSize(11).font("Helvetica-Bold")
        .text(menteeName, L, y)
        .text(mentorName, col2X, y);

      y += 15;
      doc.fillColor(C.slate500).fontSize(9.5).font("Helvetica")
        .text(menteeEmail, L, y)
        .text(mentorEmail, col2X, y);

      y += 30;
      doc.rect(L, y, W, 0.8).fill(C.slate200);

      // ═════════════════════════════════════════════════════════
      // SESSION DETAILS
      // ═════════════════════════════════════════════════════════
      y += 16;
      doc.fillColor(C.slate400).fontSize(8).font("Helvetica-Bold")
        .text(
          `SESSION DETAILS (${slots.length} session${slots.length === 1 ? "" : "s"})`,
          L, y
        );

      y += 14;
      if (slots.length === 0) {
        doc.fillColor(C.slate500).fontSize(10).font("Helvetica")
          .text("No sessions found", L, y);
        y += LINE_SM;
      } else {
        slots.forEach((slot, i) => {
          const sd = slot?.date
            ? `${slot.day}, ${formatDateShort(slot.date)}`
            : "—";
          const st = slot?.startTime && slot?.endTime
            ? `${fmt12(slot.startTime)} – ${fmt12(slot.endTime)}`
            : "—";

          doc.fillColor(C.slate400).fontSize(9.5).font("Helvetica")
            .text(`Session ${i + 1}:`, L, y);
          doc.fillColor(C.slate700)
            .text(`${sd}   •   ${st}`, 128, y);
          y += LINE_SM;
        });
      }

      // ═════════════════════════════════════════════════════════
      // SESSION TABLE
      // ═════════════════════════════════════════════════════════
      y += 14;

      doc.rect(L, y, W, 28).fill(C.slate100);
      doc.fillColor(C.slate500).fontSize(9).font("Helvetica-Bold")
        .text("Description", L + 14, y + 9)
        .text("Rate (tokens)", 285, y + 9)
        .text("Sessions", 385, y + 9)
        .text("Total", 477, y + 9);

      y += 28;
      doc.rect(L, y, W, 0.5).fill(C.slate200);

      doc.fillColor(C.slate700).fontSize(10.5).font("Helvetica")
        .text("Mentorship Session", L + 14, y + 11)
        .text(`${rate}`, 310, y + 11)
        .text(`× ${count}`, 396, y + 11);
      doc.fillColor(C.slate900).font("Helvetica-Bold")
        .text(`${baseAmount}`, 472, y + 11);

      // ═════════════════════════════════════════════════════════
      // PAYMENT BREAKDOWN
      // ═════════════════════════════════════════════════════════
      y += 44;
      doc.rect(L, y, W, 0.8).fill(C.slate200);

      y += 14;
      doc.fillColor(C.slate400).fontSize(8).font("Helvetica-Bold")
        .text("PAYMENT BREAKDOWN", L, y);

      y += 16;

      // Row 1 — base
      doc.fillColor(C.slate500).fontSize(10).font("Helvetica")
        .text(`${rate} × ${count} session${count === 1 ? "" : "s"}`, L, y);
      doc.fillColor(C.slate700).font("Helvetica-Bold")
        .text(`${baseAmount} tokens`, R - COL_W, y, { width: COL_W, align: "right" });
      y += LINE_MD;

      // Row 2 — platform fee (amber)
      doc.fillColor(C.slate500).font("Helvetica")
        .text(`Platform fee (${feePercent}%)`, L, y);
      doc.fillColor(C.amber).font("Helvetica-Bold")
        .text(`+ ${feeTokens} tokens`, R - COL_W, y, { width: COL_W, align: "right" });
      y += LINE_MD;

      // Row 3 — mentor receives (green)
      doc.fillColor(C.slate500).font("Helvetica")
        .text("Mentor receives", L, y);
      doc.fillColor(C.green).font("Helvetica-Bold")
        .text(`${mentorGets} tokens`, R - COL_W, y, { width: COL_W, align: "right" });
      y += LINE_MD + 12;

      // ── InTotal box ───────────────────────────────────────────
      const BOX_H = 40;
      doc.rect(L, y, W, BOX_H).fill(C.escrowBg);
      doc.rect(L, y, 4, BOX_H).fill(C.brand);

      doc.fillColor(C.brand).fontSize(10.5).font("Helvetica-Bold")
        .text("InTotal", L + 14, y + 13);

      doc.fillColor(C.brand).fontSize(14).font("Helvetica-Bold")
        .text(`${escrowTotal} tokens`, R - COL_W, y + 12,
          { width: COL_W, align: "right" });

      // ═════════════════════════════════════════════════════════
      // FOOTER
      // ═════════════════════════════════════════════════════════
      y += BOX_H + 30;
      doc.rect(L, y, W, 0.8).fill(C.slate200);

      y += 14;
      doc.fillColor(C.slate400).fontSize(8.5).font("Helvetica")
        .text(
          "This is a system-generated invoice. Tokens are the internal currency of the LeapMentor platform.",
          L, y, { align: "center", width: W }
        )
        .text(
          "For support, contact support@leapmentor.com",
          L, y + 14, { align: "center", width: W }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateInvoice;