import type { SerializeOptions, XmlNode } from './types.js';
import { escapeXmlAttr, escapeXmlText } from './utils.js';

export function serializeXml(node: XmlNode, options: SerializeOptions = {}): string {
  return serializeNode(node, options, 0);
}

function serializeNode(node: XmlNode, options: SerializeOptions, level: number): string {
  if (node.type === 'text') {
    return escapeXmlText(node.text);
  }

  if (node.type === 'comment') {
    return `<!--${node.text}-->`;
  }

  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => ` ${name}="${escapeXmlAttr(value)}"`)
    .join('');

  if (node.children.length === 0) {
    return `${indent(options, level)}<${node.name}${attrs}/>`;
  }

  if (!options.pretty || node.children.every((child) => child.type === 'text')) {
    const children = node.children.map((child) => serializeNode(child, options, level + 1)).join('');
    return `${indent(options, level)}<${node.name}${attrs}>${children}</${node.name}>`;
  }

  const children = node.children
    .map((child) => serializeNode(child, options, level + 1))
    .join('\n');

  return `${indent(options, level)}<${node.name}${attrs}>\n${children}\n${indent(
    options,
    level,
  )}</${node.name}>`;
}

function indent(options: SerializeOptions, level: number): string {
  if (!options.pretty) return '';

  return (options.indent ?? '  ').repeat(level);
}
