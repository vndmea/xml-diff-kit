import type { XmlDiffOptions, XmlNode } from './types.js';
import { cloneXmlNode, sortRecord } from './utils.js';

/**
 * Normalize an XML AST before diffing or patching.
 *
 * Normalization is where callers define which XML differences are meaningful.
 * For example, formatted indentation can be ignored with `ignoreWhitespaceText`,
 * comments can be ignored with `ignoreComments`, and attribute output can be
 * made deterministic with `sortAttributes`.
 *
 * The input node is cloned first. Callers can safely reuse their original AST
 * after normalization without worrying about mutation.
 */
export function normalizeXml(node: XmlNode, options: XmlDiffOptions = {}): XmlNode {
  const cloned = cloneXmlNode(node);
  const normalized = normalizeNode(cloned, options);

  if (!normalized) {
    throw new Error('Cannot normalize an empty XML document.');
  }

  return normalized;
}

/**
 * Normalize one node recursively.
 *
 * The function returns `null` for nodes that should be removed from the logical
 * comparison, such as whitespace-only text nodes or ignored comments.
 */
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
