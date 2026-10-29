import type { ManualAnswer, ManualMessage } from "./manual-types.ts";

export function normalizePolicyText(text: string) {
  let value = text;
  try {
    value = decodeURIComponent(value);
  } catch {}
  value = value.replace(
    /&#(?:x([0-9a-f]+)|(\d+));?/gi,
    (_all, hex, decimal) => {
      const point = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return point <= 0x10ffff ? String.fromCodePoint(point) : "";
    },
  );
  return value
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "")
    .toLowerCase();
}

const prohibited = [
  /\b(?:base64|rot13)\b/,
  /\b(?:python|javascript|typescript|reactjs|nextjs|nodejs|html|css|sql|bash|powershell|golang|jupyter|docker|kubernetes|terraform|pseudocode|programming|software|regex)\b/,
  /\b(?:react|next|node)\s*\.\s*js\b|\bc\+\+|\bc#/,
  /\b(?:write|create|generate|build|implement|debug|fix|refactor|execute|run|convert|translate|provide|return|give)\b[\s\S]{0,220}\b(?:code|script|function|algorithm|web\s*app|website|webpage|computer program|api endpoint)\b/,
  /\b(?:code|script|function|algorithm)\b[\s\S]{0,100}\b(?:in (?:rust|java|go|c)|programming language|for me|implement|debug|refactor)\b/,
  /```|<script\b|#include\s*[<"]|(?:^|\n)\s*(?:import\s+[a-z_]+\s+from\b|def\s+[a-z_]+\s*\(|function\s+[a-z_]+\s*\()/,
  /\b(?:ignore|disregard|forget|override|bypass|disable)\b[\s\S]{0,90}\b(?:instructions|guardrails|restrictions|system prompt|developer prompt|policies|your rules)\b/,
  /\b(?:system prompt|developer message|hidden instructions|jailbreak|developer mode|unrestricted assistant)\b|\bact as\b[\s\S]{0,70}\b(?:chatgpt|programmer|developer|assistant)\b/,
  /\b(?:reveal|print|show|extract|return|list)\b[\s\S]{0,90}\b(?:api[ _-]?keys?|secrets?|passwords?|tokens?|environment variables|system messages?)\b|process\s*\.\s*env/,
  /\b(?:base64|rot13|hexadecimal)\b[\s\S]{0,100}\b(?:decode|encode|instructions|answer|payload)\b|\b(?:decode|encode)\b[\s\S]{0,100}\b(?:base64|rot13|hexadecimal|payload)\b/,
  /[a-z0-9+/]{140,}={0,2}/,
];
export function prohibitedManualIntent(text: string) {
  const normalized = normalizePolicyText(text).replace(
    /\b(?:cage|smr|fault|diagnostic|error|nsn|usable on)\s+codes?\b/g,
    "equipment identifier",
  );
  return prohibited.some((pattern) => pattern.test(normalized));
}

const equipmentAnchor =
  /\b(?:mep[ -]?83[12]a|l70ae|generator|engine|diesel|manuals?|technical orders?|publications?|work packages?|wp|figures?|nsn|cage|smr|fault|oil|fuel|filter|strainer|torque|pressure|voltage|frequency|starter|alternator|winding|electrical|control|circuit|relay|switch|wiring|wire|valve|clearance|gasket|seal|bearing|gear|bolt|fastener|o[ -]?ring|inspection|maintenance|lubrication|overhaul|servicing|equipment|components?|parts?|rust|corrosion|coolant|intake|exhaust|governor|battery|injector|shaft|resistance|grounding|shutdown|troubleshoot|kw|hz|psi)\b|\b\d[\d-]{4,}\b/i;
export function preflightManualQuestion(
  question: string,
  history: ManualMessage[],
  context?: string,
) {
  if (prohibitedManualIntent(question)) return false;
  if (equipmentAnchor.test(normalizePolicyText(question))) return true;
  if (
    history.length &&
    history.some((message) => equipmentAnchor.test(message.content))
  )
    return true;
  return Boolean(
    context &&
    /\b(?:it|its|this|that|these|those|inspect|replace|remove|clean)\b/i.test(
      question,
    ),
  );
}

export function restrictedManualAnswer(): ManualAnswer {
  return {
    status: "restricted",
    paragraphs: [
      {
        text: "This chat is limited to the indexed generator and engine manuals. Ask about a component, specification, fault, part identifier, or work package.",
        citations: [],
      },
    ],
    sources: [],
    searchedExcerpts: 0,
  };
}

export function safeManualOutput(answer: ManualAnswer) {
  return answer.paragraphs.every(
    (paragraph) => !prohibitedManualIntent(paragraph.text),
  );
}
