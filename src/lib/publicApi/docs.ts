export function isApiDocsEnabled(flag?: string | null) {
  return String(flag ?? "").toLowerCase() === "true";
}
