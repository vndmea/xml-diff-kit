import type { TextChange, TextDiffSegment } from './types.js';

export function diffText(
  oldValue: string,
  newValue: string,
): {
  changes: TextChange[];
  segments: TextDiffSegment[];
} {
  if (oldValue === newValue) {
    return {
      changes: [],
      segments: [{ type: 'equal', text: oldValue }],
    };
  }

  const oldChars = Array.from(oldValue);
  const newChars = Array.from(newValue);

  let prefixLength = 0;
  while (
    prefixLength < oldChars.length &&
    prefixLength < newChars.length &&
    oldChars[prefixLength] === newChars[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < oldChars.length - prefixLength &&
    suffixLength < newChars.length - prefixLength &&
    oldChars[oldChars.length - 1 - suffixLength] === newChars[newChars.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const oldMiddle = oldChars.slice(prefixLength, oldChars.length - suffixLength).join('');
  const newMiddle = newChars.slice(prefixLength, newChars.length - suffixLength).join('');
  const prefix = oldChars.slice(0, prefixLength).join('');
  const suffix = oldChars.slice(oldChars.length - suffixLength).join('');

  const changes: TextChange[] = [];
  const segments: TextDiffSegment[] = [];

  if (prefix) segments.push({ type: 'equal', text: prefix });

  if (oldMiddle && newMiddle) {
    changes.push({
      op: 'replaceTextRange',
      offset: prefixLength,
      oldText: oldMiddle,
      newText: newMiddle,
    });
    segments.push({ type: 'delete', text: oldMiddle });
    segments.push({ type: 'insert', text: newMiddle });
  } else if (oldMiddle) {
    changes.push({
      op: 'deleteText',
      offset: prefixLength,
      oldText: oldMiddle,
    });
    segments.push({ type: 'delete', text: oldMiddle });
  } else if (newMiddle) {
    changes.push({
      op: 'insertText',
      offset: prefixLength,
      text: newMiddle,
    });
    segments.push({ type: 'insert', text: newMiddle });
  }

  if (suffix) segments.push({ type: 'equal', text: suffix });

  return {
    changes,
    segments,
  };
}
