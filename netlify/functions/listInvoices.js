
const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const store = getStore("invoices"); //[1](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

    const index = await store.get("index.json", { type: "json" }); // get supports json type [1](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
    const invoices = Array.isArray(index) ? index : [];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoices)
    };
  } catch (err) {
    console.error("listInvoices error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
