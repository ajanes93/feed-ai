export function formatModelName(model: string): string {
  if (model.includes("claude")) return "Claude";
  if (model.includes("gpt")) return "GPT-4";
  if (model.includes("gemini")) return "Gemini";
  return model;
}
