
import { useMemo, useState } from "react";
import { generateInvoicePDF } from "./pdf";
import "./InvoiceForm.css";
import companyLogoUrl from "./assets/company_logo.jpg";
import ownerSignUrl from "./assets/owner_sign.jpg";


const EMPTY_ITEM = { description: "", hsnCode: "", quantity: 1, kg: 0, price: 0 };


async function urlToDataURL(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // data URL
    reader.readAsDataURL(blob);
  });
}

const [companyLogo, ownerSign] = await Promise.all([
  urlToDataURL(companyLogoUrl),
  urlToDataURL(ownerSignUrl),
]);


function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function InvoiceForm({ onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

  // New global tax percentages (default 9%)
  const [cgstPct, setCgstPct] = useState(9);
  const [sgstPct, setSgstPct] = useState(9);

  const addItem = () => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  };

  const removeItem = (index) => {
    setItems((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const updateItem = (index, key, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const cleanedItems = useMemo(() => {
    return items
      .map((it) => ({
        description: String(it.description || "").trim(),
        hsnCode: String(it.hsnCode || "").trim(),
        quantity: Number(it.quantity) || 0,
        kg: Number(it.kg) || 0,
        price: Number(it.price) || 0
      }))
      .filter((it) => it.description && it.quantity > 0);
  }, [items]);

  const subtotal = useMemo(() => {
    return cleanedItems.reduce((sum, it) => sum + it.quantity * it.price, 0);
  }, [cleanedItems]);

  const cgstAmount = useMemo(() => (subtotal * (Number(cgstPct) || 0)) / 100, [subtotal, cgstPct]);
  const sgstAmount = useMemo(() => (subtotal * (Number(sgstPct) || 0)) / 100, [subtotal, sgstPct]);

  const grandTotal = useMemo(() => subtotal + cgstAmount + sgstAmount, [subtotal, cgstAmount, sgstAmount]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    const form = e.target;
    const id = form.id.value.trim();
    const client = form.client.value.trim(); // label shows Buyer Name
    const date = form.date.value;

    // Optional fields
    const buyerAddress = form.buyerAddress.value.trim();
    const gstNo = form.gstNo.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    const website = form.website.value.trim();
    const dueDate = form.dueDate.value;
    const poSoNumber = form.poSoNumber.value.trim();

    if (!id || !client || !date) {
      setError("Please fill Invoice ID, Buyer Name and Invoice Date.");
      setIsSaving(false);
      return;
    }

    if (cleanedItems.length === 0) {
      setError("Please add at least one valid line item (description + quantity).");
      setIsSaving(false);
      return;
    }

    const invoice = {
      id,
      // Keep 'client' for backward compatibility with pdf.js
      client,
      date,
      dueDate,
      poSoNumber,
      buyerAddress,
      gstNo,
      phone,
      email,
      website,
      items: cleanedItems,
      subtotal: Number(subtotal.toFixed(2)),
      taxes: {
        cgstPercent: Number(cgstPct),
        sgstPercent: Number(sgstPct),
        cgstAmount: Number(cgstAmount.toFixed(2)),
        sgstAmount: Number(sgstAmount.toFixed(2))
      },
      amount: Number(grandTotal.toFixed(2)) // total payable
    };

    // ✅ 1) Generate + download PDF FIRST
    try {
      const pdfBlob = generateInvoicePDF(invoice, { companyLogo, ownerSign });
      const fileName = `invoice-${invoice.id || "new"}.pdf`;
      downloadBlob(pdfBlob, fileName);
    } catch (pdfErr) {
      console.error(pdfErr);
      setError("PDF generation failed. Please check pdf.js setup (jspdf-autotable).");
      setIsSaving(false);
      return;
    }

    // ✅ 2) Save JSON to Netlify (PDF already downloaded)
    try {
      const res = await fetch("/.netlify/functions/saveInvoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoice)
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Save failed: ${res.status}`);
      }

      onSaved?.();
      form.reset();
      setItems([{ ...EMPTY_ITEM }]);
      setCgstPct(9);
      setSgstPct(9);
    } catch (err) {
      console.error(err);
      setError("PDF downloaded ✅ but saving failed ❌. Please try again.");
      // Do NOT reset form so user can retry saving
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="invForm" onSubmit={handleSubmit}>
      <div className="invFormHeader">
        <div>
          <h3 className="invFormTitle">Invoice Details</h3>
        </div>
      </div>

      {error && (
        <div className="invAlert" role="alert">
          <span className="invAlertDot" />
          {error}
        </div>
      )}

      {/* Basic details */}
      <div className="invGrid">
        <div className="field">
          <label htmlFor="id">Invoice ID</label>
          <input
            id="id"
            name="id"
            className="input"
            placeholder="e.g. INV-0012"
            required
            autoComplete="off"
            disabled={isSaving}
          />
          <small className="hint">Use a unique ID for tracking.</small>
        </div>

        <div className="field">
          <label htmlFor="client">Buyer Name</label>
          <input
            id="client"
            name="client"
            className="input"
            placeholder="e.g. Acme Pvt Ltd"
            required
            autoComplete="organization"
            disabled={isSaving}
          />
          <small className="hint">Customer / company being billed.</small>
        </div>

        <div className="field">
          <label htmlFor="buyerAddress">Buyer Address</label>
          <textarea
            id="buyerAddress"
            name="buyerAddress"
            className="input textarea"
            rows={2}
            placeholder="Street, City, State, PIN"
            disabled={isSaving}
          />
        </div>

        <div className="field">
          <label htmlFor="gstNo">GSTIN/UIN</label>
          <input
            id="gstNo"
            name="gstNo"
            className="input"
            placeholder="e.g. 27ABCDE1234F1Z5"
            autoComplete="off"
            disabled={isSaving}
          />
          <small className="hint">Buyer GSTIN if applicable.</small>
        </div>

        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input
            id="phone"
            name="phone"
            className="input"
            type="tel"
            placeholder="e.g. +91 98765 43210"
            autoComplete="tel"
            disabled={isSaving}
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            className="input"
            type="email"
            placeholder="e.g. accounts@buyer.com"
            autoComplete="email"
            disabled={isSaving}
          />
        </div>

        <div className="field">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            className="input"
            type="url"
            placeholder="e.g. https://buyer.com"
            autoComplete="url"
            disabled={isSaving}
          />
        </div>

        <div className="field">
          <label htmlFor="date">Invoice Date</label>
          <input
            id="date"
            name="date"
            className="input"
            type="date"
            required
            disabled={isSaving}
          />
          <small className="hint">Pick the invoice issue date.</small>
        </div>

        <div className="field">
          <label htmlFor="dueDate">Payment Due Date</label>
          <input
            id="dueDate"
            name="dueDate"
            className="input"
            type="date"
            disabled={isSaving}
          />
          <small className="hint">When payment is due.</small>
        </div>

        <div className="field">
          <label htmlFor="poSoNumber">P.O./S.O. Number</label>
          <input
            id="poSoNumber"
            name="poSoNumber"
            className="input"
            placeholder="e.g. PO-2025-0198"
            autoComplete="off"
            disabled={isSaving}
          />
          <small className="hint">Reference PO / SO number.</small>
        </div>

        {/* Taxes */}
        <div className="field">
          <label>CGST (%)</label>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={cgstPct}
            onChange={(e) => setCgstPct(e.target.value)}
            disabled={isSaving}
          />
          <small className="hint">Default 9%. Applies on subtotal.</small>
        </div>

        <div className="field">
          <label>SGST (%)</label>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={sgstPct}
            onChange={(e) => setSgstPct(e.target.value)}
            disabled={isSaving}
          />
          <small className="hint">Default 9%. Applies on subtotal.</small>
        </div>

        {/* Totals (read-only breakdown) */}
        <div className="field fieldFull">
          <label>Totals</label>
          <div className="totalBox totalStack">
            <div className="totalLine">
              <span>Subtotal&nbsp;&nbsp;</span>
              <span className="totalValue">Rs. {subtotal.toFixed(2)}</span>
            </div>
            <div className="totalLine">
              <span>CGST ({Number(cgstPct) || 0}%)&nbsp;&nbsp;</span>
              <span className="totalValue">Rs. {cgstAmount.toFixed(2)}</span>
            </div>
            <div className="totalLine">
              <span>SGST ({Number(sgstPct) || 0}%)&nbsp;&nbsp;</span>
              <span className="totalValue">Rs. {sgstAmount.toFixed(2)}</span>
            </div>
            <div className="totalLine totalGrand">
              <span>Total Payable&nbsp;&nbsp;</span>
              <span className="totalValue">Rs. {grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <small className="hint">Grand total includes CGST + SGST on entire subtotal.</small>
        </div>
      </div>

      {/* Line items */}
      <div className="itemsSection">
        <div className="itemsHeader">
          <div>
            <h4 className="itemsTitle">Line Items</h4>
            <p className="itemsSub">Add description (textarea), HSN Code, quantity, kg and price.</p>
          </div>

          <button
            type="button"
            className="btn btnGhost"
            onClick={addItem}
            disabled={isSaving}
          >
            + Add Item
          </button>
        </div>

        <div className="itemsTable">
          <div className="itemsHead">
            <span>Description</span>
            <span className="right">HSN Code</span>
            <span className="right">Qty</span>
            <span className="right">KG</span>
            <span className="right">Price</span>
            <span className="right">Total</span>
            <span />
          </div>

          {items.map((it, idx) => {
            const qty = Number(it.quantity) || 0;
            const price = Number(it.price) || 0;
            const lineTotal = qty * price;

            return (
              <div className="itemsRow" key={idx}>
                <textarea
                  className="input textarea"
                  rows={2}
                  placeholder="e.g. Transport Service"
                  value={it.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
                  disabled={isSaving}
                />

                <input
                  className="input"
                  placeholder="e.g. 9965"
                  value={it.hsnCode}
                  onChange={(e) => updateItem(idx, "hsnCode", e.target.value)}
                  disabled={isSaving}
                />

                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  disabled={isSaving}
                />

                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.kg}
                  onChange={(e) => updateItem(idx, "kg", e.target.value)}
                  disabled={isSaving}
                />

                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.price}
                  onChange={(e) => updateItem(idx, "price", e.target.value)}
                  disabled={isSaving}
                />

                <div className="lineTotal">
                  Rs. {Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : "0.00"}
                </div>

                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1 || isSaving}
                  title="Remove item"
                  aria-label="Remove item"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="invActions">
        <button
          type="reset"
          className="btn btnGhost"
          disabled={isSaving}
          onClick={() => {
            setError("");
            setItems([{ ...EMPTY_ITEM }]);
            setCgstPct(9);
            setSgstPct(9);
          }}
        >
          Clear
        </button>

        <button type="submit" className="btn btnPrimary" disabled={isSaving}>
          {isSaving ? (
            <>
              <span className="spinner" aria-hidden="true" /> Saving...
            </>
          ) : (
            "Save Invoice"
          )}
        </button>
      </div>
    </form>
  );
}
