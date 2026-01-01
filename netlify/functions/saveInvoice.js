import { getStore } from "@netlify/blobs";


export default async (req) => {
const store = getStore("invoices");
const form = await req.formData();


const invoice = JSON.parse(form.get("invoice"));
const pdf = form.get("pdf");


await store.set(`pdf/${invoice.id}.pdf`, Buffer.from(await pdf.arrayBuffer()));


const index = (await store.get("index.json").catch(() => "[]"));
const data = JSON.parse(index);


data.push(invoice);
await store.set("index.json", JSON.stringify(data));


return new Response("OK", { status: 200 });
};