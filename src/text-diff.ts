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
  const segments = buildDiffSegments(oldChars, newChars);

  return {
    changes: segmentsToChanges(segments),
    segments,
  };
}

function buildDiffSegments(oldChars: string[], newChars: string[]): TextDiffSegment[] {
  const rows = oldChars.length + 1;
  const cols = newChars.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  for (let oldIndex = oldChars.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newChars.length - 1; newIndex >= 0; newIndex -= 1) {
      if (oldChars[oldIndex] === newChars[newIndex]) {
        dp[oldIndex]![newIndex] = dp[oldIndex + 1]![newIndex + 1]! + 1;
      } else {
        dp[oldIndex]![newIndex] = Math.max(dp[oldIndex + 1]![newIndex]!, dp[oldIndex]![newIndex + 1]!);
      }
    }
  }

  const segments: TextDiffSegment[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldChars.length && newIndex < newChars.length) {
    if (oldChars[oldIndex] === newChars[newIndex]) {
      pushSegment(segments, { type: 'equal', text: oldChars[oldIndex]! });
      oldIndex += 1;
      newIndex += 1;
    } else if (dp[oldIndex + 1]![newIndex]! >= dp[oldIndex]![newIndex + 1]!) {
      pushSegment(segments, { type: 'delete', text: oldChars[oldIndex]! });
      oldIndex += 1;
    } else {
      pushSegment(segments, { type: 'insert', text: newChars[newIndex]! });
      newIndex += 1;
    }
  }

  while (oldIndex < oldChars.length) {
    pushSegment(segments, { type: 'delete', text: oldChars[oldIndex]! });
    oldIndex += 1;
  }

  while (newIndex < newChars.length) {
    pushSegment(segments, { type: 'insert', text: newChars[newIndex]! });
    newIndex += 1;
  }

  return segments;
}

function segmentsToChanges(segments: TextDiffSegment[]): TextChange[] {
  const changes: TextChange[] = [];
  let offset = 0;
  let index = 0;

  while (index < segments.length) {
    const segment = segments[index]!;

    if (segment.type === 'equal') {
      offset += Array.from(segment.text).length;
      index += 1;
      continue;
    }

    if (segment.type === 'delete') {
      const next = segments[index + 1];

      if (next?.type === 'insert') {
        changes.push({
          op: 'replaceTextRange',
          offset,
          oldText: segment.text,
          newText: next.text,
        });
        offset += Array.from(segment.text).length;
        index += 2;
        continue;
      }

      changes.push({
        op: 'deleteText',
        offset,
        oldText: segment.text,
      });
      offset += Array.from(segment.text).length;
      index += 1;
      continue;
    }

    changes.push({
      op: 'insertText',
      offset,
      text: segment.text,
    });
    index += 1;
  }

  return changes;
}

function pushSegment(segments: TextDiffSegment[], next: TextDiffSegment): void {
  const previous = segments.at(-1);

  if (previous?.type === next.type) {
    previous.text += next.text;
    return;
  }

  segments.push({ ...next });
}
