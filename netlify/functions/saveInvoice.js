
const { connectLambda, getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // ✅ Required in Lambda compatibility mode
    connectLambda(event); // [1](https://www.npmjs.com/package/@netlify/blobs)

    const store = getStore("invoices");
    const data = JSON.parse(event.body || "{}");

    const id = String(data.id || "").trim();
    const client = String(data.client || "").trim();
    const date = String(data.date || "").trim();
    const items = Array.isArray(data.items) ? data.items : [];

    if (!id || !client || !date) {
      return { statusCode: 400, body: "Missing required fields: id, client, date" };
    }

    const computed = items.reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      return sum + qty * price;
    }, 0);

    const amount = (data.amount ?? computed.toFixed(2)).toString();
    const itemsCount = items.length;

    // Save full invoice JSON
    await store.setJSON(`data/${id}.json`, { ...data, id, client, date, items, amount });

    // Update index.json
    let index = [];
    try {
      const raw = await store.get("index.json", { type: "json" });
      index = Array.isArray(raw) ? raw : [];
    } catch {
      index = [];
    }

    index = index.filter((x) => x?.id !== id);
    index.push({ id, client, date, amount, itemsCount });

    index.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));

    await store.setJSON("index.json", index);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, id }),
    };
  } catch (err) {
    console.error("saveInvoice error:", err);
    return { statusCode: 500, body: err.message || String(err) };
  }
};
