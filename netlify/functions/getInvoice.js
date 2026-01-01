
import { getStore } from "@netlify/blobs";

export async function handler(event) {
  try {
    const id = event.queryStringParameters?.id;
    if (!id) return { statusCode: 400, body: "Missing id" };

    const store = getStore("invoices");
    const raw = await store.get(`data/${id}.json`);

    if (!raw) return { statusCode: 404, body: "Invoice not found" };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="invoice-${id}.json"`
      },
      body: raw
    };
  } catch (err) {
    return { statusCode: 500, body: "Failed to fetch invoice" };
  }
}
