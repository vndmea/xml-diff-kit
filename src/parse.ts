import { DOMParser } from '@xmldom/xmldom';

import type { XmlNode } from './types.js';

/**
 * Parse an XML string into the library's normalized XML AST.
 *
 * This function is intentionally stricter than the default `@xmldom/xmldom`
 * behavior: parser warnings are treated as invalid XML. This is important for
 * a diff/patch library because silently recovering malformed XML can produce
 * surprising paths and operations.
 *
 * Only element, text, and comment nodes are currently preserved. Processing
 * instructions, doctypes, and other DOM node types are ignored during child
 * traversal until the public AST grows explicit representations for them.
 */
export function parseXml(xml: string): XmlNode {
  const doc = new DOMParser({
    errorHandler: {
      warning: (message) => {
        throw new Error(`Invalid XML: ${message}`);
      },
      error: (message) => {
        throw new Error(`Invalid XML: ${message}`);
      },
      fatalError: (message) => {
        throw new Error(`Invalid XML: ${message}`);
      },
    },
  }).parseFromString(xml, 'application/xml');

  if (!doc.documentElement) {
    throw new Error('Invalid XML: missing document element.');
  }

  return fromDomNode(doc.documentElement);
}

/** Convert a DOM node into the serializable `XmlNode` AST shape. */
function fromDomNode(node: Node): XmlNode {
  if (node.nodeType === 1) {
    const element = node as Element;
    const attrs: Record<string, string> = {};

    // Preserve attribute names and values exactly as reported by the parser.
    // Attribute ordering can be made deterministic later by `normalizeXml`.
    for (let index = 0; index < element.attributes.length; index += 1) {
      const attr = element.attributes.item(index);
      if (attr) attrs[attr.name] = attr.value;
    }

    const children: XmlNode[] = [];

    // Preserve only node kinds currently represented by the public AST.
    for (let index = 0; index < element.childNodes.length; index += 1) {
      const child = element.childNodes.item(index);

      if (child.nodeType === 1 || child.nodeType === 3 || child.nodeType === 8) {
        children.push(fromDomNode(child));
      }
    }

    return {
      type: 'element',
      name: element.nodeName,
      namespaceURI: element.namespaceURI ?? null,
      attrs,
      children,
    };
  }

  if (node.nodeType === 3) {
    return {
      type: 'text',
      text: node.nodeValue ?? '',
    };
  }

  if (node.nodeType === 8) {
    return {
      type: 'comment',
      text: node.nodeValue ?? '',
    };
  }

  throw new Error(`Unsupported XML node type: ${node.nodeType}`);
}
