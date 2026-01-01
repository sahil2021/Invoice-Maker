import { getStore } from "@netlify/blobs";


export default async (req) => {
const id = new URL(req.url).searchParams.get("id");
const store = getStore("invoices");


const pdf = await store.get(`pdf/${id}.pdf`, { type: "arrayBuffer" });


return new Response(pdf, {
headers: { "Content-Type": "application/pdf" }
});
};