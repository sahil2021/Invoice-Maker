
const { connectLambda, getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    // ✅ Required in Lambda compatibility mode
    connectLambda(event); // must run before getStore() [1](https://www.npmjs.com/package/@netlify/blobs)

    const store = getStore("invoices");

    let invoices = [];
    try {
      const raw = await store.get("index.json", { type: "json" });
      invoices = Array.isArray(raw) ? raw : [];
    } catch {
      invoices = [];
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoices),
    };
  } catch (err) {
    console.error("listInvoices error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
