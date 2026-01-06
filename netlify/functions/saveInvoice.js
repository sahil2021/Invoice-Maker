
const { connectLambda, getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // ✅ Required in Lambda compatibility mode
    connectLambda(event);

    const store = getStore("invoices");
    const data = JSON.parse(event.body || "{}");

    // --- Required fields ---
    const id = String(data.id || "").trim();
    const client = String(data.client || "").trim(); // Buyer Name (kept as 'client' for backward compatibility)
    const date = String(data.date || "").trim();

    // --- Optional invoice fields ---
    const dueDate = String(data.dueDate || "").trim();
    const poSoNumber = String(data.poSoNumber || "").trim();

    // --- Optional buyer fields ---
    const buyerAddress = String(data.buyerAddress || "").trim();
    const gstNo = String(data.gstNo || "").trim();
    const phone = String(data.phone || "").trim();
    const email = String(data.email || "").trim();
    const website = String(data.website || "").trim();

    // --- Items (with HSN support) ---
    const items = Array.isArray(data.items) ? data.items.map((it) => ({
      description: String(it?.description || "").trim(),
      hsnCode: String(it?.hsnCode || "").trim(),
      quantity: Number(it?.quantity) || 0,
      kg: Number(it?.kg) || 0,
      price: Number(it?.price) || 0,
    })) : [];

    if (!id || !client || !date) {
      return { statusCode: 400, body: "Missing required fields: id, client, date" };
    }

    if (items.length === 0) {
      return { statusCode: 400, body: "At least one valid line item is required." };
    }

    // --- Server-side totals & taxes (defensive compute) ---
    const computedSubtotal = items.reduce((sum, it) => sum + (it.quantity * it.price), 0);
    const subtotal = Number(
      (typeof data.subtotal === "number" ? data.subtotal : computedSubtotal).toFixed(2)
    );

    // Taxes payload (may come from client, else default to 9% each)
    const cgstPercent = Number(data?.taxes?.cgstPercent ?? 9);
    const sgstPercent = Number(data?.taxes?.sgstPercent ?? 9);

    // If amounts are provided, trust them; else compute
    const cgstAmount = Number(
      (typeof data?.taxes?.cgstAmount === "number"
        ? data.taxes.cgstAmount
        : (subtotal * cgstPercent) / 100
      ).toFixed(2)
    );

    const sgstAmount = Number(
      (typeof data?.taxes?.sgstAmount === "number"
        ? data.taxes.sgstAmount
        : (subtotal * sgstPercent) / 100
      ).toFixed(2)
    );

    const computedTotal = Number((subtotal + cgstAmount + sgstAmount).toFixed(2));
    const amount = Number(
      (typeof data.amount === "number" ? data.amount : computedTotal).toFixed(2)
    );

    const itemsCount = items.length;

    // --- Canonical invoice object to store ---
    const invoiceToSave = {
      id,
      client,          // Buyer Name
      date,
      dueDate,
      poSoNumber,
      buyerAddress,
      gstNo,
      phone,
      email,
      website,
      items,
      subtotal,
      taxes: {
        cgstPercent,
        sgstPercent,
        cgstAmount,
        sgstAmount,
      },
      amount,          // Total payable (subtotal + taxes)
    };

    // Save full invoice JSON under data/{id}.json
    await store.setJSON(`data/${id}.json`, invoiceToSave);

    // --- Maintain / update index.json summary ---
    let index = [];
    try {
      const raw = await store.get("index.json", { type: "json" });
      index = Array.isArray(raw) ? raw : [];
    } catch {
      index = [];
    }

    // Replace existing entry for this ID if present
    index = index.filter((x) => x?.id !== id);

    // Minimal but helpful summary for listing
    index.push({
      id,
      client,
      date,
      dueDate,
      amount,
      itemsCount,
      poSoNumber,
    });

    // Sort newest by invoice date (descending)
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
