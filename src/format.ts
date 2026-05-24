import { serializeXml } from './serialize.js';
import type { DiffSummaryItem, FormatDiffOptions, XmlDiffOp, XmlNode } from './types.js';

export function formatDiff(ops: XmlDiffOp[], options: FormatDiffOptions & { format: 'markdown' }): string;
export function formatDiff(ops: XmlDiffOp[], options?: FormatDiffOptions): DiffSummaryItem[];
export function formatDiff(
  ops: XmlDiffOp[],
  options: FormatDiffOptions = {},
): DiffSummaryItem[] | string {
  if (options.format === 'markdown') {
    return toMarkdown(ops);
  }

  return ops.map(toSummaryItem);
}

function toMarkdown(ops: XmlDiffOp[]): string {
  if (ops.length === 0) {
    return '# XML Diff\n\nNo XML differences.';
  }

  return [
    '# XML Diff',
    '',
    `Total changes: ${ops.length}`,
    '',
    ...ops.flatMap((op, index) => formatMarkdownOp(op, index + 1)),
  ].join('\n');
}

function formatMarkdownOp(op: XmlDiffOp, index: number): string[] {
  switch (op.op) {
    case 'addNode':
      return [
        `## ${index}. Added node`,
        '',
        `- Path: \`${op.path}\``,
        '',
        codeBlock('xml', serializeForMarkdown(op.value)),
        '',
      ];

    case 'removeNode':
      return [
        `## ${index}. Removed node`,
        '',
        `- Path: \`${op.path}\``,
        '',
        codeBlock('xml', serializeForMarkdown(op.oldValue)),
        '',
      ];

    case 'replaceNode':
      return [
        `## ${index}. Replaced node`,
        '',
        `- Path: \`${op.path}\``,
        '',
        '**Before**',
        '',
        codeBlock('xml', serializeForMarkdown(op.oldValue)),
        '',
        '**After**',
        '',
        codeBlock('xml', serializeForMarkdown(op.newValue)),
        '',
      ];

    case 'moveNode':
      return [
        `## ${index}. Moved node`,
        '',
        `- From: \`${op.fromPath}\``,
        `- To: \`${op.toPath}\``,
        '',
        codeBlock('xml', serializeForMarkdown(op.value)),
        '',
      ];

    case 'replaceText':
      return [
        `## ${index}. Changed text`,
        '',
        `- Path: \`${op.path}\``,
        '',
        '**Before**',
        '',
        codeBlock('text', op.oldValue),
        '',
        '**After**',
        '',
        codeBlock('text', op.newValue),
        '',
        '**Text segments**',
        '',
        ...op.segments.map((segment) => `- ${segment.type}: \`${escapeInlineCode(segment.text)}\``),
        '',
      ];

    case 'addAttr':
      return [
        `## ${index}. Added attribute`,
        '',
        `- Path: \`${op.path}\``,
        `- Name: \`${op.name}\``,
        `- Value: \`${escapeInlineCode(op.value)}\``,
        '',
      ];

    case 'updateAttr':
      return [
        `## ${index}. Updated attribute`,
        '',
        `- Path: \`${op.path}\``,
        `- Name: \`${op.name}\``,
        `- Before: \`${escapeInlineCode(op.oldValue)}\``,
        `- After: \`${escapeInlineCode(op.newValue)}\``,
        '',
      ];

    case 'removeAttr':
      return [
        `## ${index}. Removed attribute`,
        '',
        `- Path: \`${op.path}\``,
        `- Name: \`${op.name}\``,
        `- Old value: \`${escapeInlineCode(op.oldValue)}\``,
        '',
      ];
  }
}

function toSummaryItem(op: XmlDiffOp): DiffSummaryItem {
  switch (op.op) {
    case 'addNode':
      return {
        type: 'nodeAdded',
        path: op.path,
        message: `Added node at ${op.path}`,
        after: op.value,
      };

    case 'removeNode':
      return {
        type: 'nodeRemoved',
        path: op.path,
        message: `Removed node at ${op.path}`,
        before: op.oldValue,
      };

    case 'replaceNode':
      return {
        type: 'nodeReplaced',
        path: op.path,
        message: `Replaced node at ${op.path}`,
        before: op.oldValue,
        after: op.newValue,
      };

    case 'moveNode':
      return {
        type: 'nodeMoved',
        path: op.path,
        message: `Moved node from ${op.fromPath} to ${op.toPath}`,
        before: op.fromPath,
        after: op.toPath,
      };

    case 'replaceText':
      return {
        type: 'textChanged',
        path: op.path,
        message: `Changed text at ${op.path}`,
        before: op.oldValue,
        after: op.newValue,
      };

    case 'addAttr':
      return {
        type: 'attrAdded',
        path: op.path,
        message: `Added attribute ${op.name} at ${op.path}`,
        after: op.value,
      };

    case 'updateAttr':
      return {
        type: 'attrUpdated',
        path: op.path,
        message: `Updated attribute ${op.name} at ${op.path}`,
        before: op.oldValue,
        after: op.newValue,
      };

    case 'removeAttr':
      return {
        type: 'attrRemoved',
        path: op.path,
        message: `Removed attribute ${op.name} at ${op.path}`,
        before: op.oldValue,
      };
  }
}

function serializeForMarkdown(node: XmlNode): string {
  if (node.type === 'text' || node.type === 'comment') {
    return serializeXml(node);
  }

  return serializeXml(node, {
    pretty: true,
  });
}

function codeBlock(language: string, value: string): string {
  return `\`\`\`${language}\n${escapeCodeFence(value)}\n\`\`\``;
}

function escapeCodeFence(value: string): string {
  return value.replaceAll('```', '`\u200b``');
}

function escapeInlineCode(value: string): string {
  return value.replaceAll('`', '\\`');
}
