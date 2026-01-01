
import { useEffect, useMemo, useState } from "react";
import "./InvoiceList.css";
import { generateInvoicePDF } from "./pdf";

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

export default function InvoiceList({ refresh }) {
  const [q, setQ] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/.netlify/functions/listInvoices");
      if (!res.ok) throw new Error(`List failed: ${res.status}`);
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("Could not load invoices. Please try again.");
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const sorted = [...invoices].sort((a, b) => {
      const da = a?.date ? new Date(a.date).getTime() : 0;
      const db = b?.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    if (!query) return sorted;

    return sorted.filter((i) => {
      const id = String(i?.id ?? "").toLowerCase();
      const client = String(i?.client ?? "").toLowerCase();
      return id.includes(query) || client.includes(query);
    });
  }, [q, invoices]);

  const formatAmount = (amt) => {
    const n = Number(amt);
    if (Number.isNaN(n)) return amt ?? "";
    return `₹${n.toFixed(2)}`;
  };

  async function downloadJson(id) {
    // direct download from function
    window.open(
      `/.netlify/functions/getInvoice?id=${encodeURIComponent(id)}`,
      "_blank"
    );
  }

  async function downloadPdfFromJson(id) {
    // ✅ Correct endpoint for JSON-only storage
    const res = await fetch(
      `/.netlify/functions/getInvoice?id=${encodeURIComponent(id)}`
    );

    if (!res.ok) throw new Error("Unable to fetch invoice JSON");

    const invoice = await res.json(); // ✅ now it's JSON
    const blob = generateInvoicePDF(invoice);

    downloadBlob(blob, `invoice-${id}.pdf`);
  }

  return (
    <div className="invListWrap">
      <div className="invListTop compact">
        <div className="searchBox compact">
          <span className="searchIcon" aria-hidden="true">🔎</span>
          <input
            className="searchInput"
            placeholder="Search ID / Client..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              className="clearBtn"
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <button className="btn btnGhost btnSmall" type="button" onClick={load} disabled={loading}>
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="invAlert" role="alert">
          <span className="invAlertDot" />
          {error}
        </div>
      )}

      {loading && (
        <div className="skeletonList" aria-label="Loading invoices">
          <div className="skeletonRow" />
          <div className="skeletonRow" />
          <div className="skeletonRow" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="emptyState">
          <div className="emptyIcon" aria-hidden="true">🧾</div>
          <h4>No invoices found</h4>
          <p>{q ? "Try a different search term." : "Create your first invoice to see it listed here."}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="tableCard compact">
          <div className="tableHead compact">
            <span>Invoice</span>
            <span>Client</span>
            <span className="right">Items</span>
            <span className="right">Amount</span>
            <span>Date</span>
            <span className="right">Download</span>
          </div>

          {filtered.map((inv) => (
            <div className="tableRow compact" key={inv.id}>
              <div className="mono">
                <span className="idPill">{inv.id}</span>
              </div>

              <div className="clientName ellipsis" title={inv.client}>
                {inv.client}
              </div>

              <div className="right strong">{inv.itemsCount ?? "-"}</div>

              <div className="right strong">{formatAmount(inv.amount)}</div>

              <div className="muted">{inv.date || "-"}</div>

              <div className="actionsCell">
                <button
                  className="btn btnGhost btnSmall"
                  type="button"
                  onClick={() => downloadJson(inv.id)}
                >
                  JSON
                </button>

                <button
                  className="btn btnPrimary btnSmall"
                  type="button"
                  onClick={() => downloadPdfFromJson(inv.id)}
                >
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
