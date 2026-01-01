import { useState } from "react";
import InvoiceForm from "./InvoiceForm";
import InvoiceList from "./InvoiceList";

export default function App() {
  const [refresh, setRefresh] = useState(false);

  return (
    <div style={styles.bg}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>🧾 Invoice Maker</h1>
        </header>

        <main>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Create Invoice</h2>
            <InvoiceForm onSaved={() => setRefresh(!refresh)} />
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Invoices</h2>
            <InvoiceList refresh={refresh} />
          </section>
        </main>
      </div>
    </div>
  );
}

const styles = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
    padding: "40px 0"
  },
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "32px",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    borderRadius: "18px",
    boxShadow: "0 8px 32px rgba(60,60,120,0.12)",
    background: "rgba(255,255,255,0.95)"
  },
  header: {
    textAlign: "center",
    marginBottom: "36px",
    paddingBottom: "12px",
    borderBottom: "2px solid #e3e8ee"
  },
  title: {
    fontSize: "1.6rem",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#2d3748",
    margin: 0
  },
  sectionTitle: {
    fontSize: "1.3rem",
    fontWeight: 600,
    color: "#4a5568",
    marginBottom: "18px"
  },
  card: {
    background: "#fff",
    padding: "28px 24px",
    borderRadius: "12px",
    marginBottom: "28px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
    border: "1px solid #e2e8f0"
  }
};
