import { getStore } from "@netlify/blobs";


export default async () => {
const store = getStore("invoices");
const index = await store.get("index.json").catch(() => "[]");


return Response.json(JSON.parse(index));
};