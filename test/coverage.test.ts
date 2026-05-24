import { describe, expect, it } from 'vitest';

import {
  diffXml,
  formatDiff,
  normalizeXml,
  parseXml,
  patchXml,
  serializeXml,
  type XmlDiffOp,
  type XmlNode,
} from '../src/index.js';

describe('coverage focused branches', () => {
  it('serializes with custom indentation', () => {
    const node = parseXml('<root><group><item>hello</item></group></root>');

    expect(serializeXml(node, { pretty: true, indent: '    ' })).toContain('    <group>');
  });

  it('throws for XML without a document element', () => {
    expect(() => parseXml('')).toThrow('Invalid XML');
  });

  it('throws when normalization removes the whole node', () => {
    expect(() => normalizeXml({ type: 'text', text: '   ' }, { ignoreWhitespaceText: true })).toThrow(
      'Cannot normalize an empty XML document',
    );
  });

  it('keeps comments when ignoreComments is disabled', () => {
    const normalized = normalizeXml(parseXml('<root><!--note--></root>'));

    expect(normalized).toEqual({
      type: 'element',
      name: 'root',
      namespaceURI: null,
      attrs: {},
      children: [{ type: 'comment', text: 'note' }],
    });
  });

  it('returns no operations for equal XML', () => {
    expect(diffXml('<root><item>same</item></root>', '<root><item>same</item></root>')).toEqual([]);
  });

  it('diffs root node type changes from parsed AST input', () => {
    const ops = diffXml(parseXml('<root/>'), { type: 'text', text: 'plain text' });

    expect(ops).toEqual([
      {
        op: 'replaceNode',
        path: '/root[0]',
        oldValue: parseXml('<root/>'),
        newValue: { type: 'text', text: 'plain text' },
      },
    ]);
  });

  it('patches XmlNode input without serializing', () => {
    const node = parseXml('<root/>');
    const patched = patchXml(node, [
      {
        op: 'addAttr',
        path: '/root[0]',
        name: 'a',
        value: '1',
      },
    ]);

    expect(patched).toEqual({
      type: 'element',
      name: 'root',
      namespaceURI: null,
      attrs: { a: '1' },
      children: [],
    });
  });

  it('throws when mutating attributes on non-elements', () => {
    const ops: XmlDiffOp[] = [{ op: 'addAttr', path: '/root[0]/text()[0]', name: 'a', value: '1' }];

    expect(() => patchXml('<root>text</root>', ops)).toThrow('Expected element node');
  });

  it('throws when removing or moving the root node', () => {
    expect(() =>
      patchXml('<root/>', [{ op: 'removeNode', path: '/root[0]', oldValue: parseXml('<root/>') }]),
    ).toThrow('Cannot remove root node');

    expect(() =>
      patchXml('<root/>', [
        {
          op: 'moveNode',
          path: '/root[0]',
          fromPath: '/root[0]',
          toPath: '/root[0]',
          value: parseXml('<root/>'),
        },
      ]),
    ).toThrow('Cannot move root node');
  });

  it('throws when addNode path has no numeric target index', () => {
    expect(() =>
      patchXml('<root/>', [{ op: 'addNode', path: '/root[0]/item', value: parseXml('<item/>') }]),
    ).toThrow('Path has no numeric index');
  });

  it('formats every summary operation type', () => {
    const item = parseXml('<item>text</item>');
    const ops: XmlDiffOp[] = [
      { op: 'addNode', path: '/root[0]/item[0]', value: item },
      { op: 'removeNode', path: '/root[0]/item[0]', oldValue: item },
      { op: 'replaceNode', path: '/root[0]/item[0]', oldValue: item, newValue: parseXml('<next/>') },
      { op: 'moveNode', path: '/root[0]/item[0]', fromPath: '/root[0]/item[0]', toPath: '/root[0]/item[1]', value: item },
      { op: 'replaceText', path: '/root[0]/text()[0]', oldValue: 'a', newValue: 'b', changes: [], segments: [] },
      { op: 'addAttr', path: '/root[0]', name: 'a', value: '1' },
      { op: 'updateAttr', path: '/root[0]', name: 'a', oldValue: '1', newValue: '2' },
      { op: 'removeAttr', path: '/root[0]', name: 'a', oldValue: '1' },
    ];

    expect(formatDiff(ops)).toEqual([
      expect.objectContaining({ type: 'nodeAdded' }),
      expect.objectContaining({ type: 'nodeRemoved' }),
      expect.objectContaining({ type: 'nodeReplaced' }),
      expect.objectContaining({ type: 'nodeMoved' }),
      expect.objectContaining({ type: 'textChanged' }),
      expect.objectContaining({ type: 'attrAdded' }),
      expect.objectContaining({ type: 'attrUpdated' }),
      expect.objectContaining({ type: 'attrRemoved' }),
    ]);
  });

  it('formats all markdown operation branches', () => {
    const item: XmlNode = {
      type: 'element',
      name: 'item',
      namespaceURI: null,
      attrs: { a: '1' },
      children: [{ type: 'text', text: 'text' }],
    };
    const ops: XmlDiffOp[] = [
      { op: 'addNode', path: '/root[0]/item[0]', value: item },
      { op: 'removeNode', path: '/root[0]/item[0]', oldValue: item },
      { op: 'replaceNode', path: '/root[0]/item[0]', oldValue: item, newValue: parseXml('<next/>') },
      { op: 'moveNode', path: '/root[0]/item[0]', fromPath: '/root[0]/item[0]', toPath: '/root[0]/item[1]', value: item },
      { op: 'addAttr', path: '/root[0]', name: 'a', value: '1' },
      { op: 'removeAttr', path: '/root[0]', name: 'a', oldValue: '1' },
    ];
    const markdown = formatDiff(ops, { format: 'markdown' });

    expect(markdown).toContain('## 1. Added node');
    expect(markdown).toContain('## 2. Removed node');
    expect(markdown).toContain('## 3. Replaced node');
    expect(markdown).toContain('## 4. Moved node');
    expect(markdown).toContain('## 5. Added attribute');
    expect(markdown).toContain('## 6. Removed attribute');
  });
});
