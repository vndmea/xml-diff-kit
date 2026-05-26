import { describe, expect, it } from 'vitest';

import {
  diffText,
  diffXml,
  formatDiff,
  normalizeXml,
  parseXml,
  patchXml,
  serializeXml,
  type XmlDiffOp,
} from '../src/index.js';

describe('xml-diff-kit', () => {
  it('parses and serializes XML', () => {
    const node = parseXml('<root><item id="1">Hello</item></root>');

    expect(serializeXml(node)).toBe('<root><item id="1">Hello</item></root>');
  });

  it('serializes XML with escaping and comments', () => {
    const node = parseXml('<root a="1 &amp; 2"><!--note--><item>1 &lt; 2</item></root>');

    expect(serializeXml(node)).toBe('<root a="1 &amp; 2"><!--note--><item>1 &lt; 2</item></root>');
  });

  it('pretty serializes nested XML', () => {
    const node = parseXml('<root><group><item>hello</item></group></root>');

    expect(serializeXml(node, { pretty: true })).toBe('<root>\n  <group>\n    <item>hello</item>\n  </group>\n</root>');
  });

  it('throws for invalid XML', () => {
    expect(() => parseXml('<root><item></root>')).toThrow('Invalid XML');
  });

  it('normalizes whitespace, comments, text, and attributes', () => {
    const node = parseXml('<root b="2" a="1">  <!--note--><item> value </item>   </root>');
    const normalized = normalizeXml(node, {
      ignoreWhitespaceText: true,
      ignoreComments: true,
      trimText: true,
      sortAttributes: true,
    });

    expect(normalized).toEqual({
      type: 'element',
      name: 'root',
      namespaceURI: null,
      attrs: {
        a: '1',
        b: '2',
      },
      children: [
        {
          type: 'element',
          name: 'item',
          namespaceURI: null,
          attrs: {},
          children: [
            {
              type: 'text',
              text: 'value',
            },
          ],
        },
      ],
    });
  });

  it('diffs equal text as an equal segment', () => {
    const result = diffText('same', 'same');

    expect(result).toEqual({
      changes: [],
      segments: [{ type: 'equal', text: 'same' }],
    });
  });

  it('diffs text insertion, deletion, and replacement', () => {
    expect(diffText('ab', 'abc').changes).toEqual([{ op: 'insertText', offset: 2, text: 'c' }]);
    expect(diffText('abc', 'ab').changes).toEqual([{ op: 'deleteText', offset: 2, oldText: 'c' }]);
    expect(diffText('abc', 'axc').changes).toEqual([
      {
        op: 'replaceTextRange',
        offset: 1,
        oldText: 'b',
        newText: 'x',
      },
    ]);
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

  it('diffs attribute add, update, and remove operations', () => {
    const ops = diffXml('<root a="1" b="2"/>', '<root b="3" c="4"/>');

    expect(ops).toEqual([
      {
        op: 'removeAttr',
        path: '/root[0]',
        name: 'a',
        oldValue: '1',
      },
      {
        op: 'updateAttr',
        path: '/root[0]',
        name: 'b',
        oldValue: '2',
        newValue: '3',
      },
      {
        op: 'addAttr',
        path: '/root[0]',
        name: 'c',
        value: '4',
      },
    ]);
  });

  it('diffs node replacement when node names differ', () => {
    const ops = diffXml('<root><a/></root>', '<root><b/></root>');

    expect(ops).toHaveLength(1);
    expect(ops[0]?.op).toBe('replaceNode');
  });

  it('diffs comment changes as node replacement', () => {
    const ops = diffXml('<root><!--old--></root>', '<root><!--new--></root>');

    expect(ops).toHaveLength(1);
    expect(ops[0]?.op).toBe('replaceNode');
  });

  it('patches XML from diff operations', () => {
    const oldXml = '<procedure><step id="s1">Remove the panel.</step></procedure>';
    const newXml = '<procedure><step id="s1">Remove the access panel.</step><step id="s2">Inspect.</step></procedure>';

    const ops = diffXml(oldXml, newXml, {
      keyAttrs: ['id'],
    });

    expect(patchXml(oldXml, ops)).toBe(newXml);
  });

  it('patches attribute and node removal operations', () => {
    const oldXml = '<root a="1"><item>remove</item><keep>ok</keep></root>';
    const newXml = '<root><keep>ok</keep></root>';
    const ops = diffXml(oldXml, newXml);

    expect(patchXml(oldXml, ops)).toBe(newXml);
  });

  it('patches multiple sibling removals from one diff', () => {
    const oldXml = '<root><a/><b/><c/></root>';
    const newXml = '<root><a/></root>';
    const ops = diffXml(oldXml, newXml);

    expect(patchXml(oldXml, ops)).toBe(newXml);
  });

  it('patches root replacement', () => {
    const oldXml = '<oldRoot><item>old</item></oldRoot>';
    const newXml = '<newRoot><item>new</item></newRoot>';
    const ops = diffXml(oldXml, newXml);

    expect(ops[0]?.op).toBe('replaceNode');
    expect(patchXml(oldXml, ops)).toBe(newXml);
  });

  it('patches explicit move node operations', () => {
    const oldXml = '<root><item id="a"/><item id="b"/></root>';
    const ops: XmlDiffOp[] = [
      {
        op: 'moveNode',
        path: '/root[0]/item[@id="b"][1]',
        fromPath: '/root[0]/item[@id="b"][1]',
        toPath: '/root[0]/item[@id="b"][0]',
        value: {
          type: 'element',
          name: 'item',
          namespaceURI: null,
          attrs: { id: 'b' },
          children: [],
        },
      },
    ];

    expect(patchXml(oldXml, ops)).toBe('<root><item id="b"/><item id="a"/></root>');
  });

  it('throws when patching text at a non-text path', () => {
    const ops: XmlDiffOp[] = [
      {
        op: 'replaceText',
        path: '/root[0]',
        oldValue: 'old',
        newValue: 'new',
        changes: [],
        segments: [],
      },
    ];

    expect(() => patchXml('<root/>', ops)).toThrow('Cannot replace text at non-text path');
  });

  it('throws when patching a missing path', () => {
    const ops: XmlDiffOp[] = [
      {
        op: 'removeNode',
        path: '/root[0]/missing[1]',
        oldValue: { type: 'element', name: 'missing', namespaceURI: null, attrs: {}, children: [] },
      },
    ];

    expect(() => patchXml('<root/>', ops)).toThrow('Path not found');
  });

  it('throws when patching a path with the wrong root segment', () => {
    const ops: XmlDiffOp[] = [
      {
        op: 'removeNode',
        path: '/wrongRoot[0]/item[0]',
        oldValue: { type: 'element', name: 'item', namespaceURI: null, attrs: {}, children: [] },
      },
    ];

    expect(() => patchXml('<root><item/></root>', ops)).toThrow('Path not found');
  });

  it('detects keyed node moves when enabled', () => {
    const ops = diffXml('<root><item id="a"/><item id="b"/></root>', '<root><item id="b"/><item id="a"/></root>', {
      keyAttrs: ['id'],
      detectMoves: true,
    });

    expect(ops.filter((op) => op.op === 'moveNode')).toHaveLength(1);
  });

  it('patches keyed reorders when move detection is enabled', () => {
    const oldXml = '<root><item id="a"/><item id="b"/></root>';
    const newXml = '<root><item id="b"/><item id="a"/></root>';
    const ops = diffXml(oldXml, newXml, {
      keyAttrs: ['id'],
      detectMoves: true,
    });

    expect(patchXml(oldXml, ops)).toBe(newXml);
  });

  it('keeps keyed reorders stable by default for patching', () => {
    const oldXml = '<root><item id="a"/><item id="b"/></root>';
    const ops = diffXml(oldXml, '<root><item id="b"/><item id="a"/></root>', {
      keyAttrs: ['id'],
    });

    expect(ops.some((op) => op.op === 'moveNode')).toBe(false);
    expect(patchXml(oldXml, ops)).toBe(oldXml);
  });

  it('falls back to index-based diffing when keyed siblings are duplicated', () => {
    const oldXml = '<root><item id="a">1</item></root>';
    const newXml = '<root><item id="a">1</item><item id="a">2</item></root>';
    const ops = diffXml(oldXml, newXml, {
      keyAttrs: ['id'],
    });

    expect(ops.some((op) => op.op === 'addNode')).toBe(true);
    expect(patchXml(oldXml, ops)).toBe(newXml);
  });

  it('formats summary output', () => {
    const ops = diffXml('<root/>', '<root a="1"/>');
    const summary = formatDiff(ops);

    expect(summary).toEqual([
      {
        type: 'attrAdded',
        path: '/root[0]',
        message: 'Added attribute a at /root[0]',
        after: '1',
      },
    ]);
  });

  it('formats empty diff output as markdown', () => {
    expect(formatDiff([], { format: 'markdown' })).toBe('# XML Diff\n\nNo XML differences.');
  });

  it('formats node operations as markdown XML blocks', () => {
    const markdown = formatDiff(diffXml('<root><a/></root>', '<root><b/></root>'), { format: 'markdown' });

    expect(markdown).toContain('## 1. Replaced node');
    expect(markdown).toContain('```xml');
    expect(markdown).toContain('<a/>');
    expect(markdown).toContain('<b/>');
  });

  it('formats diff output as markdown report', () => {
    const ops = diffXml(
      '<procedure status="draft"><step id="s1">Remove the panel.</step></procedure>',
      '<procedure status="released"><step id="s1">Remove the access panel.</step></procedure>',
      {
        keyAttrs: ['id'],
      },
    );
    const markdown = formatDiff(ops, { format: 'markdown' });

    expect(markdown).toContain('# XML Diff');
    expect(markdown).toContain('Total changes: 2');
    expect(markdown).toContain('## 1. Updated attribute');
    expect(markdown).toContain('- Name: `status`');
    expect(markdown).toContain('- Before: `draft`');
    expect(markdown).toContain('- After: `released`');
    expect(markdown).toContain('## 2. Changed text');
    expect(markdown).toContain('**Before**');
    expect(markdown).toContain('Remove the panel.');
    expect(markdown).toContain('Remove the access panel.');
    expect(markdown).toContain('**Text segments**');
    expect(markdown).toContain('- insert: `access `');
  });
});
