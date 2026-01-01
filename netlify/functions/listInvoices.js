
import { getStore } from "@netlify/blobs";

export async function handler() {
  try {
    const store = getStore("invoices");

    let invoices = [];
    try {
      const raw = await store.get("index.json");
      invoices = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(invoices)) invoices = [];
    } catch {
      invoices = [];
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoices)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
