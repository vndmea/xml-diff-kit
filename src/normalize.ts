import type { XmlDiffOptions, XmlNode } from './types.js';
import { cloneXmlNode, sortRecord } from './utils.js';

export function normalizeXml(node: XmlNode, options: XmlDiffOptions = {}): XmlNode {
  const cloned = cloneXmlNode(node);
  const normalized = normalizeNode(cloned, options);

  if (!normalized) {
    throw new Error('Cannot normalize an empty XML document.');
  }

  return normalized;
}

function normalizeNode(node: XmlNode, options: XmlDiffOptions): XmlNode | null {
  if (node.type === 'text') {
    const text = options.trimText ? node.text.trim() : node.text;

    if (options.ignoreWhitespaceText && text.trim() === '') {
      return null;
    }

    return {
      type: 'text',
      text,
    };
  }

  if (node.type === 'comment') {
    if (options.ignoreComments) return null;

    return node;
  }

  const children = node.children
    .map((child) => normalizeNode(child, options))
    .filter((child): child is XmlNode => Boolean(child));

  return {
    ...node,
    attrs: options.sortAttributes ? sortRecord(node.attrs) : { ...node.attrs },
    children,
  };
}
