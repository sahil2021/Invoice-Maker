
import { getStore } from "@netlify/blobs";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const store = getStore("invoices");
    const data = JSON.parse(event.body || "{}");

    const id = String(data.id || "").trim();
    const client = String(data.client || "").trim();
    const date = String(data.date || "").trim();
    const items = Array.isArray(data.items) ? data.items : [];

    if (!id || !client || !date) {
      return { statusCode: 400, body: "Missing required fields: id, client, date" };
    }

    // Compute amount (trust client amount if present, else compute)
    const computed = items.reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return sum + qty * price;
    }, 0);

    const amount = data.amount ?? computed.toFixed(2);
    const itemsCount = items.length;

    const fullInvoice = {
      ...data,
      id,
      client,
      date,
      items,
      amount
    };

    // Save full invoice JSON
    await store.set(`data/${id}.json`, JSON.stringify(fullInvoice, null, 2));

    // Update index.json
    let index = [];
    try {
      const raw = await store.get("index.json");
      index = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(index)) index = [];
    } catch {
      index = [];
    }

    // De-duplicate by id (update existing)
    index = index.filter((x) => x?.id !== id);
    index.push({ id, client, date, amount, itemsCount });

    // Sort by date desc
    index.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));

    await store.set("index.json", JSON.stringify(index, null, 2));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, id })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: err?.message ? err.message : String(err) };
  }
}
