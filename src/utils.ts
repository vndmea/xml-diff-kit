import type { XmlElementNode, XmlNode } from './types.js';

export function isElementNode(node: XmlNode): node is XmlElementNode {
  return node.type === 'element';
}

export function cloneXmlNode<T extends XmlNode>(node: T): T {
  return structuredClone(node) as T;
}

export function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replaceAll('"', '&quot;');
}

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

export function formatPathSegment(node: XmlNode, index: number, keyAttrs: string[] = []): string {
  if (node.type === 'text') return `text()[${index}]`;
  if (node.type === 'comment') return `comment()[${index}]`;

  const keyAttr = keyAttrs.find((attr) => node.attrs[attr] !== undefined);
  const keyValue = keyAttr ? node.attrs[keyAttr] : undefined;
  const keyPart = keyAttr && keyValue !== undefined ? `[@${keyAttr}="${keyValue}"]` : '';

  return `${node.name}${keyPart}[${index}]`;
}
