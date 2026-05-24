import { DOMParser } from '@xmldom/xmldom';

import type { XmlNode } from './types.js';

export function parseXml(xml: string): XmlNode {
  const doc = new DOMParser({
    errorHandler: {
      warning: () => undefined,
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

function fromDomNode(node: Node): XmlNode {
  if (node.nodeType === 1) {
    const element = node as Element;
    const attrs: Record<string, string> = {};

    for (let index = 0; index < element.attributes.length; index += 1) {
      const attr = element.attributes.item(index);
      if (attr) attrs[attr.name] = attr.value;
    }

    const children: XmlNode[] = [];

    for (let index = 0; index < element.childNodes.length; index += 1) {
      const child = element.childNodes.item(index);

      if (child.nodeType === 1 || child.nodeType === 3 || child.nodeType === 8) {
        children.push(fromDomNode(child));
      }
    }

    return {
      type: 'element',
      name: element.nodeName,
      namespaceURI: element.namespaceURI,
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
