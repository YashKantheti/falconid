export type ManualDocument = {
  id: string;
  code: string;
  title: string;
  edition: string;
  url: string;
  pages: number;
  sha256: string;
  aliases: string;
};
export type ManualChunk = {
  id: string;
  documentId: string;
  page: number;
  printedPage: string;
  heading: string;
  text: string;
  indexPage: boolean;
};
export type ManualCorpus = {
  version: number;
  documents: ManualDocument[];
  chunks: ManualChunk[];
};
export type ManualHit = ManualChunk & { score: number };
export type ManualMessage = { role: "user" | "assistant"; content: string };
export type ManualCitation = {
  id: number;
  sourceId: string;
  documentId: string;
  code: string;
  title: string;
  edition: string;
  page: number;
  printedPage: string;
  heading: string;
  url: string;
  quote: string;
  excerpt: string;
};
export type ManualAnswer = {
  status: "answered" | "insufficient";
  paragraphs: { text: string; citations: number[] }[];
  sources: ManualCitation[];
  searchedExcerpts: number;
  model?: string;
};
