// Minimal XML helpers for ARCA's fixed SOAP schemas: escaping for the requests we build and tag
// extraction for the responses we read. Not a general XML parser; no new dependencies.

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

/** `<name>text</name>`, with the text escaped. */
export function element(name: string, text: string | number): string {
  return `<${name}>${escapeXml(String(text))}</${name}>`;
}

const tagPattern = (name: string): RegExp =>
  new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>)`, 'g');

/** Inner (still encoded) XML of every `name` element, any namespace prefix; self-closing ones are ''. */
export function innerXmlAll(xml: string, name: string): string[] {
  return [...xml.matchAll(tagPattern(name))].map((match) => match[1] ?? '');
}

export function innerXml(xml: string, name: string): string | undefined {
  return innerXmlAll(xml, name)[0];
}

/** Decoded, trimmed text of the first `name` element, or undefined when absent or empty. */
export function textOf(xml: string, name: string): string | undefined {
  const inner = innerXml(xml, name);
  if (inner === undefined) return undefined;
  const text = decodeXml(inner).trim();
  return text === '' ? undefined : text;
}
