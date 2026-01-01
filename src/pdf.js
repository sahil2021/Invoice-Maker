import jsPDF from "jspdf";


export function generateInvoicePDF(invoice) {
const doc = new jsPDF();


doc.setFontSize(18);
doc.text("INVOICE", 20, 20);


doc.setFontSize(12);
doc.text(`Invoice ID: ${invoice.id}`, 20, 40);
doc.text(`Client: ${invoice.client}`, 20, 50);
doc.text(`Date: ${invoice.date}`, 20, 60);
doc.text(`Amount: $${invoice.amount}`, 20, 70);


return doc.output("blob");
}