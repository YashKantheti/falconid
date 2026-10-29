import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3000",
  workspace = crypto.randomUUID();
let requests = 0;
async function post(mutation, extra = {}) {
  const r = await fetch(origin + "/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...extra },
    body: JSON.stringify({ workspace, mutation }),
  });
  requests++;
  return { status: r.status, data: await r.json() };
}
const id = crypto.randomUUID(),
  request = {
    kind: "request",
    record: {
      id,
      number: "client-ignored",
      createdAt: new Date().toISOString(),
      requester: "Demo API test",
      assetId: "AGE-044",
      location: "Demo test spot",
      priority: "Routine",
      items: [{ partId: "DEMO-059", name: "untrusted client label", qty: 2 }],
    },
  };
let r = await post(request);
assert.equal(r.status, 200);
r = await post(request);
assert.equal(r.status, 200);
assert.equal(r.data.duplicate, true);
for (const action of ["Acknowledged", "Picking", "Ready", "Delivered"]) {
  const event = {
    kind: "event",
    record: {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      target: "request",
      targetId: id,
      action,
      author: "Demo API test",
    },
  };
  r = await post(event);
  assert.equal(r.status, 200);
  r = await post(event);
  assert.equal(r.status, 200);
  assert.equal(r.data.duplicate, true);
}
const data = await (
  await fetch(origin + "/api/workspace?workspace=" + workspace)
).json();
assert.equal(data.requests.filter((r) => r.id === id).length, 1);
assert.equal(
  data.requests.find((r) => r.id === id).items[0].name,
  "Air filter",
);
assert.equal(data.events.filter((e) => e.targetId === id).length, 4);
r = await post({
  ...request,
  record: {
    ...request.record,
    id: crypto.randomUUID(),
    items: [{ partId: "DEMO-999", qty: 2 }],
  },
});
assert.equal(r.status, 400);
r = await post({
  ...request,
  record: {
    ...request.record,
    id: crypto.randomUUID(),
    items: [{ partId: "DEMO-059", qty: -1 }],
  },
});
assert.equal(r.status, 400);
r = await post(request, { Origin: "https://unrelated.example" });
assert.equal(r.status, 403);
const other = await (
  await fetch(origin + "/api/workspace?workspace=" + crypto.randomUUID())
).json();
assert.equal(
  other.requests.some((r) => r.id === id),
  false,
);
const invalid = await fetch(origin + "/api/workspace?workspace=../../unsafe");
assert.equal(invalid.status, 400);
console.log(
  "API smoke passed:",
  requests,
  "writes/retries, status progression, canonical catalog labels, invalid inputs, origin checks, and workspace isolation.",
);
