import TechnicalChat from "@/components/manuals/TechnicalChat";
import "./manuals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Technical chat | FalconID",
  description:
    "Ask the indexed Technical Orders and inspect exact source quotes and PDF-page citations.",
};

export default function ManualsPage() {
  return <TechnicalChat />;
}
