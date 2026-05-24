import type { XmlElementNode, XmlNode } from './types.js';

/** Return true when a normalized XML node is an element node. */
export function isElementNode(node: XmlNode): node is XmlElementNode {
  return node.type === 'element';
}

/**
 * Deep-clone a normalized XML node.
 *
 * `structuredClone` is available in the supported Node.js versions and modern
 * browsers. The AST is plain data, so structured cloning is sufficient and keeps
 * the library free of an additional cloning dependency.
 */
export function cloneXmlNode<T extends XmlNode>(node: T): T {
  return structuredClone(node) as T;
}

/** Return a new record sorted by key for deterministic serialization/diffing. */
export function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

/** Escape XML text-node content. */
export function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Escape XML attribute values. */
export function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replaceAll('"', '&quot;');
}

/**
 * Build a stable semantic key for an element using the first matching key attr.
 *
 * The key includes the element name to avoid treating `<step id="1"/>` and
 * `<figure id="1"/>` as the same logical node.
 */
export function getNodeKey(node: XmlNode, keyAttrs: string[] = []): string | undefined {
  if (!isElementNode(node)) return undefined;

  for (const keyAttr of keyAttrs) {
    const value = node.attrs[keyAttr];
    if (value !== undefined) {
      return `${node.name}:${keyAttr}=${value}`;
    }
  }

  return undefined;
}

/**
 * Format one absolute-path segment for a node.
 *
 * Every segment includes a numeric sibling index, which is the executable part
 * used by patching. When a key attribute is available, the segment also includes
 * a readable key hint such as `step[@id="s1"][0]`.
 */
export function formatPathSegment(node: XmlNode, index: number, keyAttrs: string[] = []): string {
  if (node.type === 'text') return `text()[${index}]`;
  if (node.type === 'comment') return `comment()[${index}]`;

  const keyAttr = keyAttrs.find((attr) => node.attrs[attr] !== undefined);
  const keyValue = keyAttr ? node.attrs[keyAttr] : undefined;
  const keyPart = keyAttr && keyValue !== undefined ? `[@${keyAttr}="${keyValue}"]` : '';

  return `${node.name}${keyPart}[${index}]`;
}
