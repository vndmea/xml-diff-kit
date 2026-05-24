import { describe, expect, it } from 'vitest';

import { diffXml, formatDiff, parseXml, patchXml, type XmlDiffOp } from '../src/index.js';

describe('additional branch coverage', () => {
  it('falls back to index comparison when keyAttrs do not match any child', () => {
    const ops = diffXml('<root><item>old</item></root>', '<root><item>new</item></root>', {
      keyAttrs: ['missing'],
    });

    expect(ops).toHaveLength(1);
    expect(ops[0]?.op).toBe('replaceText');
    expect(ops[0]?.path).toBe('/root[0]/item[0]/text()[0]');
  });

  it('removes keyed nodes that are missing from the new document', () => {
    const ops = diffXml('<root><item id="a"/><item id="b"/></root>', '<root><item id="b"/></root>', {
      keyAttrs: ['id'],
    });

    expect(ops).toEqual([
      {
        op: 'removeNode',
        path: '/root[0]/item[@id="a"][0]',
        oldValue: {
          type: 'element',
          name: 'item',
          namespaceURI: null,
          attrs: { id: 'a' },
          children: [],
        },
      },
    ]);
  });

  it('patches explicit updateAttr and removeAttr operations', () => {
    const ops: XmlDiffOp[] = [
      {
        op: 'updateAttr',
        path: '/root[0]',
        name: 'a',
        oldValue: '1',
        newValue: '2',
      },
      {
        op: 'removeAttr',
        path: '/root[0]',
        name: 'b',
        oldValue: '3',
      },
    ];

    expect(patchXml('<root a="1" b="3"/>', ops)).toBe('<root a="2"/>');
  });

  it('patches explicit non-root replaceNode operations', () => {
    const ops: XmlDiffOp[] = [
      {
        op: 'replaceNode',
        path: '/root[0]/item[0]',
        oldValue: parseXml('<item>old</item>'),
        newValue: parseXml('<next>new</next>'),
      },
    ];

    expect(patchXml('<root><item>old</item></root>', ops)).toBe('<root><next>new</next></root>');
  });

  it('escapes backticks inside markdown inline code spans', () => {
    const ops: XmlDiffOp[] = [
      {
        op: 'addAttr',
        path: '/root[0]',
        name: 'a',
        value: '`quoted`',
      },
      {
        op: 'updateAttr',
        path: '/root[0]',
        name: 'b',
        oldValue: '`old`',
        newValue: '`new`',
      },
    ];

    const markdown = formatDiff(ops, { format: 'markdown' });

    expect(markdown).toContain('\\`quoted\\`');
    expect(markdown).toContain('\\`old\\`');
    expect(markdown).toContain('\\`new\\`');
  });
});
