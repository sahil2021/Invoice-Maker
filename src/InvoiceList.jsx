
import { useEffect, useMemo, useState } from "react";
import "./InvoiceList.css";

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
    // refresh triggers re-fetch from App after saving
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return invoices;

    return invoices.filter((i) => {
      const id = String(i?.id ?? "");
      const client = String(i?.client ?? "").toLowerCase();
      return id.includes(query) || client.includes(query);
    });
  }, [q, invoices]);

  const formatAmount = (amt) => {
    const n = Number(amt);
    if (Number.isNaN(n)) return amt ?? "";
    // keep your "$" for now since your original UI uses it
    return `$${n.toFixed(2)}`;
  };

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

      {/* Loading state */}
      {loading && (
        <div className="skeletonList" aria-label="Loading invoices">
          <div className="skeletonRow" />
          <div className="skeletonRow" />
          <div className="skeletonRow" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="emptyState">
          <div className="emptyIcon" aria-hidden="true">🧾</div>
          <h4>No invoices found</h4>
          <p>{q ? "Try a different search term." : "Create your first invoice to see it listed here."}</p>
        </div>
      )}

      {/* Desktop table */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="tableCard desktopOnly">
            <div className="tableHead">
              <span>Invoice ID</span>
              <span>Client</span>
              <span className="right">Amount</span>
              <span>Date</span>
              <span className="right">PDF</span>
            </div>

            {filtered.map((inv) => (
              <div className="tableRow" key={inv.id}>
                <div className="mono">
                  <span className="idPill">{inv.id}</span>
                </div>

                <div className="clientCell">
                  <div className="clientName">{inv.client}</div>
                </div>

                <div className="right strong">{formatAmount(inv.amount)}</div>

                <div className="muted">{inv.date || "-"}</div>

                <div className="right">
                  <a
                    className="btn btnPrimary btnSmall"
                    href={`/.netlify/functions/getInvoice?id=${encodeURIComponent(inv.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="mobileOnly cardGrid">
            {filtered.map((inv) => (
              <div className="invCard" key={inv.id}>
                <div className="invCardTop">
                  <span className="idPill mono">{inv.id}</span>
                  <span className="amtPill">{formatAmount(inv.amount)}</span>
                </div>

                <div className="invCardBody">
                  <div className="clientName">{inv.client}</div>
                  <div className="muted">{inv.date || "-"}</div>
                </div>

                <div className="invCardActions">
                  <a
                    className="btn btnPrimary"
                    href={`/.netlify/functions/getInvoice?id=${encodeURIComponent(inv.id)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
