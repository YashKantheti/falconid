import {
  preflightManualQuestion,
  restrictedManualAnswer,
  safeManualOutput,
} from "./manual-policy.ts";
import type { ManualAnswer, ManualMessage } from "./manual-types.ts";

export async function guardedManualChat(
  input: { question: string; history: ManualMessage[]; context?: string },
  dependencies: {
    consumeQuota(): Promise<void>;
    scopeAllowed(): Promise<boolean>;
    answer(): Promise<ManualAnswer>;
  },
): Promise<ManualAnswer> {
  if (!preflightManualQuestion(input.question, input.history, input.context))
    return restrictedManualAnswer();
  await dependencies.consumeQuota();
  if (!(await dependencies.scopeAllowed())) return restrictedManualAnswer();
  const answer = await dependencies.answer();
  return safeManualOutput(answer) ? answer : restrictedManualAnswer();
}
