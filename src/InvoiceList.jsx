
import { useEffect, useMemo, useState } from "react";
import "./InvoiceList.css";
// OPTIONAL: enable if you want PDF download from JSON
import { generateInvoicePDF } from "./pdf";

function downloadUrl(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
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

  useEffect(() => { load(); }, [refresh]);

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

  // OPTIONAL: download PDF by fetching JSON and generating PDF client-side

  async function downloadPdfFromJson(id) {
    const res = await fetch(`/.netlify/functions/getInvoiceJson?id=${encodeURIComponent(id)}`);
    const invoice = await res.json();
    const blob = generateInvoicePDF(invoice);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="invListWrap">
      <div className="invListTop">
        <div className="searchBox">
          <span className="searchIcon" aria-hidden="true">🔎</span>
          <input
            className="searchInput"
            placeholder="Search by Invoice ID or Client..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="clearBtn" type="button" onClick={() => setQ("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <button className="btn btnGhost" type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
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
        <div className="tableCard">
          <div className="tableHead">
            <span>Invoice ID</span>
            <span>Client</span>
            <span className="right">Items</span>
            <span className="right">Amount</span>
            <span>Date</span>
            <span className="right">Download</span>
          </div>

          {filtered.map((inv) => (
            <div className="tableRow" key={inv.id}>
              <div className="mono"><span className="idPill">{inv.id}</span></div>
              <div className="clientName">{inv.client}</div>
              <div className="right strong">{inv.itemsCount ?? "-"}</div>
              <div className="right strong">{formatAmount(inv.amount)}</div>
              <div className="muted">{inv.date || "-"}</div>

              <div className="right" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {/* ✅ Download JSON */}
                {/* <button
                  className="btn btnGhost btnSmall"
                  type="button"
                  onClick={() =>
                    downloadUrl(`/.netlify/functions/getInvoiceJson?id=${encodeURIComponent(inv.id)}`)
                  }
                >
                  JSON
                </button> */}

                {/* OPTIONAL: PDF download from JSON */}
                {
                <button
                  className="btn btnPrimary btnSmall"
                  type="button"
                  onClick={() => downloadPdfFromJson(inv.id)}
                >
                  PDF
                </button>
        }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
