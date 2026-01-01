
const { connectLambda, getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    connectLambda(event); // [1](https://www.npmjs.com/package/@netlify/blobs)
    const id = event.queryStringParameters?.id;
    if (!id) return { statusCode: 400, body: "Missing id" };

    const store = getStore("invoices");
    const raw = await store.get(`data/${id}.json`);

    if (!raw) return { statusCode: 404, body: "Invoice not found" };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="invoice-${id}.json"`,
      },
      body: raw,
    };
  } catch (err) {
    console.error("getInvoiceJson error:", err);
    return { statusCode: 500, body: "Failed to fetch invoice" };
  }
};
