import type { DiffSummaryItem, FormatDiffOptions, XmlDiffOp } from './types.js';

export function formatDiff(ops: XmlDiffOp[], options: FormatDiffOptions & { format: 'markdown' }): string;
export function formatDiff(ops: XmlDiffOp[], options?: FormatDiffOptions): DiffSummaryItem[];
export function formatDiff(
  ops: XmlDiffOp[],
  options: FormatDiffOptions = {},
): DiffSummaryItem[] | string {
  const summary = ops.map(toSummaryItem);

  if (options.format === 'markdown') {
    return summary.map((item) => `- ${item.message}`).join('\n');
  }

  return summary;
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
