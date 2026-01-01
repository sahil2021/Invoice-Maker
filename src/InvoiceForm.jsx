
import { useState } from "react";
import { generateInvoicePDF } from "./pdf";
import "./InvoiceForm.css";

export default function InvoiceForm({ onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSaving(true);

    const form = e.target;

    const invoice = {
      id: form.id.value.trim(),
      client: form.client.value.trim(),
      amount: form.amount.value,
      date: form.date.value
    };

    try {
      const pdfBlob = generateInvoicePDF(invoice);

      const body = new FormData();
      body.append("invoice", JSON.stringify(invoice));
      // Optional filename helps some backends; harmless even if ignored:
      body.append("pdf", pdfBlob, `invoice-${invoice.id || "new"}.pdf`);

      const res = await fetch("/.netlify/functions/saveInvoice", {
        method: "POST",
        body
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      onSaved?.();
      form.reset();
    } catch (err) {
      setError("Something went wrong while saving. Please try again.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="invForm" onSubmit={handleSubmit}>
      <div className="invFormHeader">
        <div>
          <h3 className="invFormTitle">Invoice Details</h3>
          <p className="invFormSub">Fill in basic invoice info and create a PDF instantly.</p>
        </div>

        <div className="invFormBadge" aria-hidden="true">
          PDF Ready
        </div>
      </div>

      {error && (
        <div className="invAlert" role="alert">
          <span className="invAlertDot" />
          {error}
        </div>
      )}

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
          />
          <small className="hint">Customer / company being billed.</small>
        </div>

        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            name="amount"
            className="input"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 25000"
            required
            inputMode="decimal"
          />
          <small className="hint">Enter numeric value (e.g. 1250.50)</small>
        </div>

        <div className="field">
          <label htmlFor="date">Invoice Date</label>
          <input id="date" name="date" className="input" type="date" required />
          <small className="hint">Pick the invoice issue date.</small>
        </div>
      </div>

      <div className="invActions">
        <button
          type="reset"
          className="btn btnGhost"
          disabled={isSaving}
          onClick={() => setError("")}
        >
          Clear
        </button>

        <button type="submit" className="btn btnPrimary" disabled={isSaving}>
          {isSaving ? (
            <>
              <span className="spinner" aria-hidden="true" /> Creating...
            </>
          ) : (
            "Create Invoice"
          )}
        </button>
      </div>
    </form>
  );
}
