export type Photo = {
  path: string;
  title: string;
  sourceUrl: string;
  originalUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  modified: string;
  description: string;
};
export type CatalogPart = {
  id: string;
  name: string;
  category: string;
  description: string;
  inspection: string;
  photos: Photo[];
  inventory: {
    quantity: number;
    bin: string;
    unitPrice: number;
    updatedAt: string;
  };
  nsn: string | null;
  partNumber: string | null;
  compatibility: string;
  cage?: string;
  platform?: string;
  capturePath?: string;
  diagram?: string;
  imageProvenance?: string;
  documents?: {
    title: string;
    code: string;
    detail: string;
    url: string;
    kind: string;
  }[];
  sourceUrl: string;
};
export type Asset = {
  id: string;
  name: string;
  location: string;
  serial: string;
  condition: "Ready" | "Inspection due" | "Awaiting parts";
  partIds: string[];
};
export type RequestStatus =
  "Submitted" | "Acknowledged" | "Picking" | "Ready" | "Delivered";
export const REQUEST_STATUSES: RequestStatus[] = [
  "Submitted",
  "Acknowledged",
  "Picking",
  "Ready",
  "Delivered",
];
export type SupplyItem = { partId: string; name: string; qty: number };
export type SupplyRequest = {
  id: string;
  number: string;
  createdAt: string;
  requester: string;
  assetId: string;
  location: string;
  priority: "Routine" | "Urgent";
  items: SupplyItem[];
};
export type Handover = {
  id: string;
  createdAt: string;
  author: string;
  assetId: string;
  type: "Hazard" | "Pass-down" | "General";
  title: string;
  body: string;
  owner: string;
};
export type Activity = {
  id: string;
  createdAt: string;
  targetId: string;
  target: "request" | "note";
  action: RequestStatus | "Acknowledged" | "Resolved" | "Reopened";
  author: string;
};
export type ScanRecord = {
  id: string;
  createdAt: string;
  assetId: string;
  partId: string;
  method:
    | "Photo candidate"
    | "Reference photo"
    | "AI vision + vectors"
    | "AI vector match"
    | "Manual lookup"
    | "Barcode";
  confirmed: boolean;
};
export type WorkspaceData = {
  requests: SupplyRequest[];
  notes: Handover[];
  events: Activity[];
  scans: ScanRecord[];
  storage: "cloud" | "local";
};
export type PendingMutation = {
  kind: "request" | "note" | "event" | "scan";
  record: SupplyRequest | Handover | Activity | ScanRecord;
};
export type Candidate = {
  partId: string;
  similarity: number;
  rankingScore?: number;
  reference: string;
  referenceMatch: boolean;
};
export type MatchResult = {
  candidates: Candidate[];
  reliable: boolean;
  method:
    | "Photo candidate"
    | "Reference photo"
    | "AI vector match"
    | "AI vision + vectors";
  vision?: {
    status: "applied" | "not_configured" | "unavailable";
    provider: string;
    model: string;
    reason: string;
    selectedPartId?: string;
    rankedPartIds?: string[];
    matchQuality?: "strong" | "possible" | "none";
    observedFeatures?: string[];
    visibleMarkings?: string;
  };
  dimensions?: number;
  searched?: number;
  model?: string;
  margin?: number;
  elapsedMs: number;
};
