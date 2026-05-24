import { describe, expect, it } from 'vitest';

import { diffText, diffXml, formatDiff, parseXml, patchXml, serializeXml } from '../src/index.js';

describe('xml-diff-kit', () => {
  it('parses and serializes XML', () => {
    const node = parseXml('<root><item id="1">Hello</item></root>');

    expect(serializeXml(node)).toBe('<root><item id="1">Hello</item></root>');
  });

  it('diffs text changes with nested text operations', () => {
    const result = diffText('Remove the panel.', 'Remove the access panel.');

    expect(result.changes).toEqual([
      {
        op: 'insertText',
        offset: 11,
        text: 'access ',
      },
    ]);
  });

  it('diffs multiple text changes as separate segments', () => {
    const result = diffText('A quick brown cat.', 'A slow brown dog.');

    expect(result.segments).toEqual([
      { type: 'equal', text: 'A ' },
      { type: 'delete', text: 'quick' },
      { type: 'insert', text: 'slow' },
      { type: 'equal', text: ' brown ' },
      { type: 'delete', text: 'cat' },
      { type: 'insert', text: 'dog' },
      { type: 'equal', text: '.' },
    ]);
  });

  it('generates structured XML diff operations', () => {
    const ops = diffXml(
      '<procedure><step id="s1">Remove the panel.</step></procedure>',
      '<procedure><step id="s1">Remove the access panel.</step><step id="s2">Inspect.</step></procedure>',
      {
        keyAttrs: ['id'],
      },
    );

    expect(ops).toHaveLength(2);
    expect(ops[0]?.op).toBe('replaceText');
    expect(ops[1]?.op).toBe('addNode');
  });

  it('patches XML from diff operations', () => {
    const oldXml = '<procedure><step id="s1">Remove the panel.</step></procedure>';
    const newXml = '<procedure><step id="s1">Remove the access panel.</step><step id="s2">Inspect.</step></procedure>';

    const ops = diffXml(oldXml, newXml, {
      keyAttrs: ['id'],
    });

    expect(patchXml(oldXml, ops)).toBe(newXml);
  });

  it('detects keyed node moves when enabled', () => {
    const ops = diffXml('<root><item id="a"/><item id="b"/></root>', '<root><item id="b"/><item id="a"/></root>', {
      keyAttrs: ['id'],
      detectMoves: true,
    });

    expect(ops.some((op) => op.op === 'moveNode')).toBe(true);
  });

  it('keeps keyed reorders stable by default for patching', () => {
    const oldXml = '<root><item id="a"/><item id="b"/></root>';
    const ops = diffXml(oldXml, '<root><item id="b"/><item id="a"/></root>', {
      keyAttrs: ['id'],
    });

    expect(ops.some((op) => op.op === 'moveNode')).toBe(false);
    expect(patchXml(oldXml, ops)).toBe(oldXml);
  });

  it('formats diff output as markdown', () => {
    const ops = diffXml('<root a="1"/>', '<root a="2"/>');
    const markdown = formatDiff(ops, { format: 'markdown' });

    expect(markdown).toContain('Updated attribute a');
  });
});
