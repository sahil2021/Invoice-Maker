
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const id = event.queryStringParameters?.id;
    if (!id) return { statusCode: 400, body: "Missing id" };

    const store = getStore("invoices"); //[1](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
    const invoice = await store.get(`data/${id}.json`); // get returns null if missing [1](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

    if (!invoice) return { statusCode: 404, body: "Invoice not found" };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="invoice-${id}.json"`
      },
      body: invoice
    };
  } catch (err) {
    console.error("getInvoiceJson error:", err);
    return { statusCode: 500, body: "Failed to fetch invoice" };
  }
};
