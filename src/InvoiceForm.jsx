
import { useMemo, useState } from "react";
import { generateInvoicePDF } from "./pdf"; // ✅ add this back
import "./InvoiceForm.css";

const EMPTY_ITEM = { description: "", quantity: 1, kg: 0, price: 0 };

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
        quantity: Number(it.quantity) || 0,
        kg: Number(it.kg) || 0,
        price: Number(it.price) || 0
      }))
      .filter((it) => it.description && it.quantity > 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    return cleanedItems.reduce((sum, it) => sum + it.quantity * it.price, 0);
  }, [cleanedItems]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    const form = e.target;
    const id = form.id.value.trim();
    const client = form.client.value.trim();
    const date = form.date.value;

    if (!id || !client || !date) {
      setError("Please fill Invoice ID, Client Name and Date.");
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
      client,
      date,
      items: cleanedItems,
      amount: grandTotal.toFixed(2)
    };

    // ✅ 1) Generate + download PDF FIRST (even if saving fails)
    try {
      const pdfBlob = generateInvoicePDF(invoice);
      const fileName = `invoice-${invoice.id || "new"}.pdf`;
      downloadBlob(pdfBlob, fileName);
    } catch (pdfErr) {
      console.error(pdfErr);
      setError("PDF generation failed. Please check pdf.js setup (jspdf-autotable).");
      setIsSaving(false);
      return; // stop here because user requested PDF on submit
    }

    // ✅ 2) Then try saving JSON to Netlify (can fail; PDF already downloaded)
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

        <div className="invFormBadge" aria-hidden="true">
          Saved to Netlify
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
          <label htmlFor="client">Client Name</label>
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
          <label>Grand Total</label>
          <div className="totalBox">
            <span className="totalValue">₹{grandTotal.toFixed(2)}</span>
            <span className="totalHint">Auto-calculated from valid items</span>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="itemsSection">
        <div className="itemsHeader">
          <div>
            <h4 className="itemsTitle">Line Items</h4>
            <p className="itemsSub">Add description, quantity, kg and price.</p>
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
                <input
                  className="input"
                  placeholder="e.g. Transport Service"
                  value={it.description}
                  onChange={(e) => updateItem(idx, "description", e.target.value)}
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
                  ₹{Number.isFinite(lineTotal) ? lineTotal.toFixed(2) : "0.00"}
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
