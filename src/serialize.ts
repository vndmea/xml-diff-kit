import type { SerializeOptions, XmlNode } from './types.js';
import { escapeXmlAttr, escapeXmlText } from './utils.js';

/**
 * Serialize a normalized XML AST back to XML text.
 *
 * The serializer is intentionally small and deterministic. It does not attempt
 * to preserve the original lexical formatting of the input XML; instead, it
 * serializes the current AST state. Use `pretty` when human-readable nested
 * output is preferred.
 */
export function serializeXml(node: XmlNode, options: SerializeOptions = {}): string {
  return serializeNode(node, options, 0);
}

/** Serialize one node recursively. */
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

  // Keep text-only elements inline even in pretty mode so simple content like
  // `<title>Hello</title>` does not become unnecessarily noisy.
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

/** Return indentation for a nesting level when pretty output is enabled. */
function indent(options: SerializeOptions, level: number): string {
  if (!options.pretty) return '';

  return (options.indent ?? '  ').repeat(level);
}
