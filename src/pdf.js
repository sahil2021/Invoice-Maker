import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export function generateInvoicePDF(invoice) {
  const doc = new jsPDF();

  // ===== HEADER =====
  doc.setFontSize(18);
  doc.text("INVOICE", 14, 20);

  doc.setFontSize(10);
  doc.text("Your Company Name", 14, 28);
  doc.text("Address Line 1", 14, 34);
  doc.text("Email: company@email.com", 14, 40);

  // Invoice info
  doc.text(`Invoice #: ${invoice.id}`, 140, 28);
  doc.text(`Date: ${invoice.date}`, 140, 34);

  // ===== CLIENT =====
  doc.setFontSize(12);
  doc.text("Bill To:", 14, 55);
  doc.setFontSize(10);
  doc.text(invoice.client || "-", 14, 62);

  // ===== TABLE =====
  const safeItems = Array.isArray(invoice.items) ? invoice.items : [];

  const tableData = safeItems.map((item) => {
    const qty = Number(item.quantity) || 0;
    const kg = Number(item.kg) || 0;
    const price = Number(item.price) || 0;
    const total = qty * price;

    return [
      item.description || "",
      qty,
      kg,
      `$${price.toFixed(2)}`,
      `$${total.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: 75,
    head: [["Description", "Qty", "KG", "Price", "Total"]],
    body: tableData,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [0, 0, 0] },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" }
    }
  });

  // ===== GRAND TOTAL =====
  const grandTotal = safeItems.reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const price = Number(i.price) || 0;
    return sum + qty * price;
  }, 0);

  // doc.lastAutoTable is added by the plugin after autoTable runs
  const finalY = (doc.lastAutoTable?.finalY || 75) + 10;

  doc.setFontSize(12);
  doc.text(`Grand Total: $${grandTotal.toFixed(2)}`, 140, finalY);

  return doc.output("blob");
}