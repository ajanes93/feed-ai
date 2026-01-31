export function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}
