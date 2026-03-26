// backend/utils/generateInvoice.js
const PDFDocument = require("pdfkit");

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
        totalAmount,
        paidAt,
      } = data;

      const slots =
        Array.isArray(selectedSlots) && selectedSlots.length > 0
          ? selectedSlots
          : confirmedSlot
            ? [confirmedSlot]
            : [];

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // ── Helpers ──────────────────────────────────────────────
      const formatTime = (time) => {
        if (!time) return "";
        const [h, m] = time.split(":").map(Number);
        const ampm = h >= 12 ? "PM" : "AM";
        const hour = h % 12 || 12;
        return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
      };

      const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      };

      const paidDate = paidAt
        ? new Date(paidAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
        : "—";

      // ── Header ──────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill("#1D4ED8");

      doc
        .fillColor("#FFFFFF")
        .fontSize(26)
        .font("Helvetica-Bold")
        .text("Leapmentor", 50, 25);

      doc
        .fontSize(10)
        .font("Helvetica")
        .text("Mentorship Platform", 50, 55);

      doc.moveDown(3);

      // ── Invoice title ───────────────────────────────────────
      doc
        .fillColor("#1D4ED8")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("INVOICE", 50, 110);

      doc
        .fillColor("#64748B")
        .fontSize(10)
        .font("Helvetica")
        .text(`Invoice No: ${invoiceNumber}`, 50, 138)
        .text(`Date Issued: ${paidDate}`, 50, 153);

      // ── Divider ─────────────────────────────────────────────
      doc
        .moveTo(50, 175)
        .lineTo(545, 175)
        .strokeColor("#E2E8F0")
        .lineWidth(1)
        .stroke();

      // ── Billed To / Mentor ──────────────────────────────────
      doc
        .fillColor("#0F172A")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("BILLED TO", 50, 195)
        .font("Helvetica")
        .fillColor("#334155")
        .fontSize(11)
        .text(menteeName, 50, 212)
        .fillColor("#64748B")
        .fontSize(10)
        .text(menteeEmail, 50, 228);

      doc
        .fillColor("#0F172A")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("SESSION WITH", 320, 195)
        .font("Helvetica")
        .fillColor("#334155")
        .fontSize(11)
        .text(mentorName, 320, 212)
        .fillColor("#64748B")
        .fontSize(10)
        .text(mentorEmail, 320, 228);

      // ── Divider ─────────────────────────────────────────────
      doc
        .moveTo(50, 255)
        .lineTo(545, 255)
        .strokeColor("#E2E8F0")
        .lineWidth(1)
        .stroke();

      // ── Session details ─────────────────────────────────────
      doc
        .fillColor("#0F172A")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(
          `SESSION DETAILS (${slots.length} session${slots.length !== 1 ? "s" : ""
          })`,
          50,
          270
        );

      let slotY = 290;
      const slotLineHeight = 17;

      if (slots.length === 0) {
        doc
          .fillColor("#64748B")
          .fontSize(10)
          .font("Helvetica")
          .text("No sessions found", 50, slotY);
        slotY += slotLineHeight;
      } else {
        slots.forEach((slot, i) => {
          const sessionDate = slot?.date
            ? `${slot.day}, ${formatDate(slot.date)}`
            : "—";

          const sessionTime =
            slot?.startTime && slot?.endTime
              ? `${formatTime(slot.startTime)} – ${formatTime(
                slot.endTime
              )}`
              : "—";

          doc
            .fillColor("#64748B")
            .fontSize(10)
            .font("Helvetica")
            .text(`Session ${i + 1}:`, 50, slotY)
            .fillColor("#334155")
            .text(`${sessionDate}  •  ${sessionTime}`, 130, slotY);

          slotY += slotLineHeight;
        });
      }

      // ── Table ───────────────────────────────────────────────
      const tableTop = slotY + 18;

      doc.rect(50, tableTop, 495, 30).fill("#F1F5F9");

      doc
        .fillColor("#475569")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Description", 65, tableTop + 10)
        .text("Rate (tokens)", 280, tableTop + 10)
        .text("Sessions", 380, tableTop + 10)
        .text("Total", 470, tableTop + 10);

      const rowTop = tableTop + 30;

      doc
        .moveTo(50, rowTop)
        .lineTo(545, rowTop)
        .strokeColor("#E2E8F0")
        .lineWidth(0.5)
        .stroke();

      doc
        .fillColor("#334155")
        .fontSize(11)
        .font("Helvetica")
        .text("Mentorship Session", 65, rowTop + 10)
        .text(`${sessionRate}`, 310, rowTop + 10)
        .text(`× ${sessionCount}`, 390, rowTop + 10)
        .font("Helvetica-Bold")
        .text(`${totalAmount}`, 470, rowTop + 10);

      // ── Footer (adjusted) ───────────────────────────────────
      const footerY = rowTop + 48;

      doc
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .strokeColor("#E2E8F0")
        .lineWidth(1)
        .stroke();

      doc
        .fillColor("#94A3B8")
        .fontSize(9)
        .font("Helvetica")
        .text(
          "This is a system-generated invoice. Tokens are the internal currency of the Leapmentor platform.",
          50,
          footerY + 12,
          { align: "center", width: 495 }
        )
        .text(
          "For support, contact support@leapmentor.com",
          50,
          footerY + 28,
          { align: "center", width: 495 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateInvoice;