"""Extract the two source PDFs with physical PDF-page provenance. Requires pypdf."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
DOCUMENTS = [
    dict(id="generator-2010", code="TO 35C2-3-386-51W/IPB", title="MEP-831A / MEP-832A operator and field maintenance", edition="30 April 2010", filename="mep-832a-2010.pdf", url="https://www.radiomanual.info/schemi/Surplus_Accessories/MEP-831A_MEP-832A_serv_user_TM9-6115-639-13P_2010.pdf", aliases="TM 9-6115-639-13&P MEP831A MEP832A generator 3 kW 400 Hz"),
    dict(id="engine-2000", code="TO 38G1-128-2", title="L70AE-DEGFR diesel engine maintenance", edition="1 November 2000", filename="l70ae-2000.pdf", url="https://www.liberatedmanuals.com/TM-9-2815-257-24.pdf", aliases="TM 9-2815-257-24 Yanmar L70AE engine diesel"),
]
chunks = []
docs = []
for definition in DOCUMENTS:
    source = ROOT / "work/research" / definition["filename"]
    reader = PdfReader(source)
    doc = {key: value for key, value in definition.items() if key != "filename"}
    doc.update(pages=len(reader.pages), sha256=hashlib.sha256(source.read_bytes()).hexdigest())
    docs.append(doc)
    for number, page in enumerate(reader.pages, 1):
        raw = page.extract_text(extraction_mode="layout") or ""
        lines = [re.sub(r"[\t ]+", " ", line).strip() for line in raw.splitlines()]
        text = "\n".join(lines)
        text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        if len(text) < 45:
            continue
        nonempty = [line for line in lines if line]
        footer = next((line for line in reversed(nonempty[-5:]) if re.fullmatch(r"(?:\d{4}-\d+|[A-Z]?\d+-\d+|[A-Z]-\d+|[ivx]+|[a-z])(?:/.*)?", line)), "")
        wp = re.match(r"(\d{4})-", footer)
        heading_lines = [line for line in nonempty[:10] if not re.search(r"^(?:ARMY |AIR FORCE |MARINE CORPS |TM \d|TO \d)", line) and not re.fullmatch(r"[\d -]+", line)]
        heading = " · ".join(heading_lines[:3])[:200]
        if wp:
            heading = "WP " + wp.group(1) + " · " + heading
        start, index = 0, 0
        while start < len(text):
            end = min(start + 2450, len(text))
            if end < len(text):
                newline = text.rfind("\n", start + 1500, end)
                if newline > start:
                    end = newline
            excerpt = text[start:end].strip()
            chunks.append(dict(id=f"{doc['id']}-p{number}-c{index}", documentId=doc["id"], page=number, printedPage=footer, heading=heading, text=excerpt, indexPage=bool(re.search(r"TABLE OF CONTENTS|ALPHABETICAL INDEX|LIST OF ILLUSTRATIONS", text))))
            if end >= len(text):
                break
            start = max(start + 1, end - 360)
            index += 1
        if number % 100 == 0:
            print(doc["id"], number, "pages indexed", flush=True)
output = ROOT / "data/technical-manuals.json"
output.write_text(json.dumps(dict(version=1, documents=docs, chunks=chunks), ensure_ascii=False, separators=(",", ":")))
print(len(docs), "manuals;", sum(d["pages"] for d in docs), "PDF pages;", len(chunks), "page-bound excerpts;", output.stat().st_size, "bytes", flush=True)
