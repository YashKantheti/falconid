import {
  REQUEST_STATUSES,
  type Activity,
  type SupplyRequest,
  type Handover,
  type PendingMutation,
  type WorkspaceData,
} from "./demo-types.ts";
export function requestStatus(request: SupplyRequest, events: Activity[]) {
  const changes = events.filter(
    (e) => e.target === "request" && e.targetId === request.id,
  );
  return changes.reduce(
    (status, e) => {
      const action = e.action as typeof status;
      return REQUEST_STATUSES.indexOf(action) > REQUEST_STATUSES.indexOf(status)
        ? action
        : status;
    },
    "Submitted" as (typeof REQUEST_STATUSES)[number],
  );
}
export function noteStatus(note: Handover, events: Activity[]) {
  const changes = events
    .filter((e) => e.target === "note" && e.targetId === note.id)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  let resolved = false;
  for (const e of changes) {
    if (e.action === "Resolved") resolved = true;
    if (e.action === "Reopened") resolved = false;
  }
  return {
    resolved,
    acknowledged: changes
      .filter((e) => e.action === "Acknowledged")
      .map((e) => e.author)
      .filter((v, i, a) => a.indexOf(v) === i),
  };
}
export function mergeMutation(
  data: WorkspaceData,
  mutation: PendingMutation,
): WorkspaceData {
  const key = (
    {
      request: "requests",
      note: "notes",
      event: "events",
      scan: "scans",
    } as const
  )[mutation.kind];
  const records = data[key] as { id: string }[];
  if (records.some((x) => x.id === mutation.record.id)) return data;
  return { ...data, [key]: [mutation.record, ...records] };
}
