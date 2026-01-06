
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generate Invoice PDF based on enriched invoice fields.
 * @param {Object} invoice - enriched invoice payload
 * @param {Object} [assets] - optional assets { companyLogo, ownerSign } (base64 or HTMLImageElement)
 * @returns {Blob}
 */
export function generateInvoicePDF(invoice, assets = {}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Margins & layout constants
  const MARGIN_LEFT = 14;
  const MARGIN_RIGHT = 14;
  const MARGIN_TOP = 18;
  const MARGIN_BOTTOM = 14;

  doc.setLineHeightFactor(1.28); // make multi-line spacing consistent

  let cursorY = MARGIN_TOP; // running Y pointer

  // Helpers
  const pad = (n) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
  const safe = (v, def = "-") => (v ? String(v) : def);
  const addCenteredTitle = (text, y) => {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const textWidth = doc.getTextWidth(text);
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };
  const addOptionalImage = (img, x, y, w, h) => {
    try {
      if (img) doc.addImage(img, "PNG", x, y, w, h, undefined, "FAST");
    } catch {
      /* silently skip if bad image */
    }
  };
  const sectionTitle = (label, y) => {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(label, MARGIN_LEFT, y);
  };
  const smallTextLeft = (txt, x, y) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(txt, x, y);
  };
  const smallTextRight = (txt, x, y) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(txt, x, y, { align: "right" });
  };
  const wrapLines = (text, maxWidth) => {
    const str = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return doc.splitTextToSize(str, maxWidth);
  };

  // Extract known fields with sensible defaults
  const {
    id = "",
    client = "",
    date = "",
    dueDate = "",
    poSoNumber = "",
    buyerAddress = "",
    gstNo = "",
    phone = "",
    email = "",
    website = "",
    items = [],
    subtotal: subtotalInput,
    taxes = {},
    amount: amountInput
  } = invoice || {};

  const cgstPercent = Number(taxes?.cgstPercent ?? 9);
  const sgstPercent = Number(taxes?.sgstPercent ?? 9);

  const computedSubtotal = Array.isArray(items)
    ? items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0)
    : 0;

  const subtotal = Number.isFinite(subtotalInput) ? subtotalInput : computedSubtotal;
  const cgstAmount = Number.isFinite(taxes?.cgstAmount)
    ? taxes.cgstAmount
    : (subtotal * cgstPercent) / 100;
  const sgstAmount = Number.isFinite(taxes?.sgstAmount)
    ? taxes.sgstAmount
    : (subtotal * sgstPercent) / 100;

  const grandTotal = Number.isFinite(amountInput)
    ? amountInput
    : subtotal + cgstAmount + sgstAmount;

  // ========== 1) INVOICE HEADING (centered) ==========
  addCenteredTitle("INVOICE", cursorY);
  cursorY += 10;

  // ========== 2) TWO-COLUMN HEADER ==========
  // Left column: logo + company block
  const leftX = MARGIN_LEFT;
  const colTopY = cursorY;

  // Logo (optional) ~ 28w x 18h
  addOptionalImage(assets.companyLogo, leftX, colTopY-5, 28, 18);

  // Company block
  let companyBlockY = colTopY + (assets.companyLogo ? 22 : 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Trimurti Fabricators", leftX, companyBlockY); companyBlockY += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  smallTextLeft("GSTIN/UIN: 27BLPPS5945BIZO", leftX, companyBlockY); companyBlockY += 5;

  const companyAddr = [
    "Address: M/s J. K Machine Tools, Ground Floor,",
    "Plot No : B99, Shanti Nagar road no 27, Wagle Estate Thane,",
    "Shanti Nagar, Thane West, Maharashtra, India - 400604",
  ];
  companyAddr.forEach((line) => { smallTextLeft(line, leftX, companyBlockY); companyBlockY += 5; });
  smallTextLeft("Mobile: 9820493390", leftX, companyBlockY); companyBlockY += 5;
  smallTextLeft("Email: ravishete74@gmail.com", leftX, companyBlockY); companyBlockY += 5;

  // Right column: invoice meta (RIGHT‑ALIGNED)  
  const metaRightX = pageWidth - MARGIN_RIGHT;
  let metaY = colTopY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Invoice Details", metaRightX, metaY, { align: "right" });
  metaY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // helper to add meta line only if value exists
  const addMetaLine = (label, value) => {
    const v = String(value || "").trim();
    if (!v) return;
    smallTextRight(`${label}: ${v}`, metaRightX, metaY);
    metaY += 5;
  };

  addMetaLine("Invoice ID", id);
  addMetaLine("Invoice Date", date);
  addMetaLine("P.O./S.O. Number", poSoNumber);   // will be skipped if empty
  addMetaLine("Payment Due Date", dueDate);


  cursorY = Math.max(companyBlockY, metaY) + 6;
  
  //add horizontal line
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, cursorY - 4, pageWidth - MARGIN_RIGHT, cursorY - 4);

  cursorY += 5; // small breathing space

  // ========== 3) BUYER DETAILS (with proper wrapping) ==========
  sectionTitle("Buyer Details", cursorY);
  cursorY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Always show Buyer Name
  smallTextLeft(`Buyer Name: ${safe(client)}`, MARGIN_LEFT, cursorY);
  cursorY += 5;

  // Address: wrap if present, otherwise skip
  if (buyerAddress && buyerAddress.trim().length > 0) {
    const addressLabel = "Address:";
    const labelWidth = doc.getTextWidth(addressLabel);
    const availableWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT - labelWidth - 6;
    const wrappedAddr = wrapLines(buyerAddress, availableWidth);

    doc.text(addressLabel, MARGIN_LEFT, cursorY);
    doc.text(wrappedAddr, MARGIN_LEFT + labelWidth + 6, cursorY);
    cursorY += wrappedAddr.length * 5;
  }

  // helper to add buyer line only if value exists
  const addBuyerLine = (label, value) => {
    const v = String(value || "").trim();
    if (!v) return;
    smallTextLeft(`${label}: ${v}`, MARGIN_LEFT, cursorY);
    cursorY += 5;
  };

  // These will appear only when present
  addBuyerLine("GSTIN", gstNo);
  addBuyerLine("Phone", phone);
  addBuyerLine("Email", email);
  addBuyerLine("Website", website);

  cursorY += 1; // small breathing space

  // ========== 4) ITEMS TABLE (WITH HSN; autoTable wraps long descriptions) ==========
  const safeItems = Array.isArray(items) ? items : [];
  const itemRows = safeItems.map((it) => {
    const qty = Number(it.quantity) || 0;
    const kg = Number(it.kg) || 0;
    const price = Number(it.price) || 0;
    const total = qty * price;
    return [
      it.description || "",
      it.hsnCode || "",
      qty,
      kg,
      `Rs. ${pad(price)}`,
      `Rs. ${pad(total)}`
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [["Description", "HSN Code", "Qty", "KG", "Price", "Total"]],
    body: itemRows,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [34, 34, 34], textColor: [255, 255, 255] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    // allow autoTable to carry across pages for long item lists
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8;

  // Subtotal beneath items table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Items Subtotal: Rs. ${pad(subtotal)}`, pageWidth - MARGIN_RIGHT, cursorY, { align: "right" });
  cursorY += 8;

  // ========== 5) TAX CALCULATION (CGST + SGST + Total) ==========
  sectionTitle("Tax Calculation", cursorY); cursorY += 6;
  autoTable(doc, {
    startY: cursorY,
    head: [["Component", "Percent", "Amount (INR)"]],
    body: [
      ["Subtotal", "-", `Rs. ${pad(subtotal)}`],
      ["CGST", `${pad(cgstPercent)}%`, `Rs. ${pad(cgstAmount)}`],
      ["SGST", `${pad(sgstPercent)}%`, `Rs. ${pad(sgstAmount)}`],
      ["Total (Subtotal + Taxes)", "-", `Rs. ${pad(subtotal + cgstAmount + sgstAmount)}`],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [34, 34, 34], textColor: [255, 255, 255] },
    columnStyles: {
      2: { halign: "right" },
    }
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 8;

  // ========== 6) AMOUNT DUE (GRAND TOTAL) ==========
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Amount Due (INR):", MARGIN_LEFT, cursorY);
  doc.setFontSize(15);
  doc.text(`Rs. ${pad(grandTotal)}`, pageWidth - MARGIN_RIGHT, cursorY, { align: "right" });
  cursorY += 10;

  // ========== 7, 8, 9, 10 ON NEXT PAGE ==========
  doc.addPage();
  cursorY = MARGIN_TOP;

  // (7) GST BREAKDOWN BY HSN (only if Buyer GST present)
  if (gstNo && gstNo.trim().length > 0) {
    sectionTitle("Taxable Amount Breakdown (GST Registered Buyer)", cursorY); cursorY += 6;

    // Aggregate taxable amount per HSN
    const hsnMap = new Map(); // hsn -> taxable
    safeItems.forEach((it) => {
      const hsn = (it.hsnCode || "").trim() || "-";
      const taxable = (Number(it.quantity) || 0) * (Number(it.price) || 0);
      hsnMap.set(hsn, (hsnMap.get(hsn) || 0) + taxable);
    });

    const breakdownRows = [];
    let totalTaxAmount = 0;

    for (const [hsn, taxable] of hsnMap.entries()) {
      const cgstAmt = (taxable * cgstPercent) / 100;
      const sgstAmt = (taxable * sgstPercent) / 100;

      breakdownRows.push([hsn, `Rs. ${pad(taxable)}`, "CGST", `${pad(cgstPercent)}%`, `Rs. ${pad(cgstAmt)}`]);
      breakdownRows.push([hsn, `Rs. ${pad(taxable)}`, "SGST", `${pad(sgstPercent)}%`, `Rs. ${pad(sgstAmt)}`]);

      totalTaxAmount += cgstAmt + sgstAmt;
    }

    autoTable(doc, {
      startY: cursorY,
      head: [["HSN Code", "Taxable Amount", "Tax Name", "Tax %", "Tax Amount"]],
      body: breakdownRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 34, 34], textColor: [255, 255, 255] },
      columnStyles: {
        1: { halign: "right" },
        4: { halign: "right" },
      },
      foot: [["", "", "TOTAL TAX", "", `Rs. ${pad(totalTaxAmount)}`]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 10;
  }

  // Before placing terms & bank, ensure we keep space for the signature area at page bottom
  const SIGN_AREA_HEIGHT = 52;      // total area reserved for signatures
  const FINAL_NOTE_HEIGHT = 10;     // "computer-generated" line
  const RESERVED_BOTTOM = SIGN_AREA_HEIGHT + FINAL_NOTE_HEIGHT + 8; // padding

  // If current cursor would enter reserved bottom area, start another page
  if (cursorY > pageHeight - MARGIN_BOTTOM - RESERVED_BOTTOM - 20) {
    doc.addPage();
    cursorY = MARGIN_TOP;
  }

  // (8) TERMS & CONDITIONS — wrapped correctly
  sectionTitle("Terms & Conditions", cursorY); cursorY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const termsText = [
    "1) Interest will be recovered @ 24% p.a. on overdue unpaid bills.",
    "2) Claim of any nature whatsoever will lapse unless raised in writing within 3 days from date of Invoice.",
    "3) Goods once sold cannot be returned and/or exchanged.",
    "4) We reserve to ourselves the right to demand payment of this bill at any time before due date.",
    "5) Payment are to be made at our office by A/c payee's cheque.",
    "6) 70% advance against invoice; remaining 30% amount after inspection.",
  ].join("\n");

  const wrappedTerms = wrapLines(termsText, pageWidth - MARGIN_LEFT - MARGIN_RIGHT);
  doc.text(wrappedTerms, MARGIN_LEFT, cursorY);
  cursorY += wrappedTerms.length * 4 + 8;

  // If terms ran too long, move bank details to a fresh page to keep signature area free
  if (cursorY > pageHeight - MARGIN_BOTTOM - RESERVED_BOTTOM - 10) {
    doc.addPage();
    cursorY = MARGIN_TOP;
  }

  // (9) BANK DETAILS
  sectionTitle("Bank Details", cursorY); cursorY += 6;
  doc.setFontSize(10);
  const bankLines = [
    "Account Number: 099100100005977",
    "Account Holder's Name: Trimurti Fabricators",
    "Bank Name: Saraswat Co-operative Bank LTD.",
    "IFSC Code: SRCB0000099",
    "Swift Code: -",
    "Address: Rameshwar Bhavan, Ground Floor, CHS Ltd., Pokharan Rd Number 1,",
    "opp. Raymond Shop, Samata Nagar, Thane West, Thane, Maharashtra 400606",
  ];
  bankLines.forEach((l) => { smallTextLeft(l, MARGIN_LEFT, cursorY); cursorY += 5; });
  cursorY += 2;

  // ========== 10) SIGNATURES — ALWAYS AT BOTTOM ==========
  // If content has flowed into signature space, move to new page
  
// If content has flowed into signature space, move to new page
const signTopY = pageHeight - MARGIN_BOTTOM - SIGN_AREA_HEIGHT;
if (cursorY > signTopY - 6) {
  doc.addPage();
}

// Recompute signTopY for the current page
const sigY = pageHeight - MARGIN_BOTTOM - SIGN_AREA_HEIGHT;

// Row title
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text("For Trimurti Fabricators", MARGIN_LEFT, sigY);

// Columns: Customer Sign (left) | Authorised Signatory (right, right-aligned)
const colMid = pageWidth / 2;
const sigBoxTop = sigY + 6;

doc.setFont("helvetica", "normal");
doc.setFontSize(10);

// Left column: Customer Signature (blank box)
smallTextLeft("Customer Signature", MARGIN_LEFT, sigBoxTop);
doc.rect(
  MARGIN_LEFT,
  sigBoxTop + 2,
  colMid - MARGIN_LEFT - 14,
  24
); // blank signature box

// Right column: Authorised Signatory (RIGHT-ALIGNED)
const authLabelX = pageWidth - MARGIN_RIGHT;
smallTextRight("Authorised Signatory", authLabelX, sigBoxTop);

// Align the signature image so its RIGHT EDGE sits at the right margin
const signImgW = 40;
const signImgH = 20;
addOptionalImage(
  assets.ownerSign,
  authLabelX - signImgW,   // x so image ends at right margin
  sigBoxTop + 2,
  signImgW,
  signImgH
);

// Final note at absolute bottom center of the page
const finalNoteY = pageHeight - MARGIN_BOTTOM - 6;
doc.setFont("helvetica", "italic");
doc.setFontSize(9);
doc.text(
  "This is a computer-generated invoice.",
  pageWidth / 2,
  finalNoteY,
  { align: "center" }
);

// Return Blob
return doc.output("blob");
}
