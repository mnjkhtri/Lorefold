const LORE_ORIGIN = "https://lore.kernel.org";

export function safeLoreMessageHref(messageId: string): string {
  return `${LORE_ORIGIN}/all/${encodeURIComponent(messageId)}/`;
}

export function safeLoreThreadHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== LORE_ORIGIN || url.search !== "" || url.hash !== "") return undefined;
    if (!/^\/(?:all|lkml)\/[^/?#]+\/?$/u.test(url.pathname)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
