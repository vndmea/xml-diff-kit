# xml-diff-kit

A TypeScript toolkit for parsing, normalizing, diffing, patching, and formatting XML document changes.

`xml-diff-kit` is designed for applications that need machine-readable XML differences rather than visual line-based diffs, such as structured editors, review workflows, change tracking, and patch application.

## Install

```bash
pnpm add xml-diff-kit
```

## Usage

```ts
import { diffXml, patchXml, formatDiff } from 'xml-diff-kit';

const oldXml = `
<procedure>
  <step id="s1">Remove the panel.</step>
</procedure>
`;

const newXml = `
<procedure>
  <step id="s1">Remove the access panel.</step>
  <step id="s2">Inspect the connector.</step>
</procedure>
`;

const ops = diffXml(oldXml, newXml, {
  ignoreWhitespaceText: true,
  keyAttrs: ['id'],
});

console.log(ops);
console.log(formatDiff(ops, { format: 'markdown' }));

const patchedXml = patchXml(oldXml, ops, {
  pretty: true,
});

console.log(patchedXml);
```

Example output:

```ts
[
  {
    op: 'replaceText',
    path: '/procedure[0]/step[@id="s1"][0]/text()[0]',
    oldValue: 'Remove the panel.',
    newValue: 'Remove the access panel.',
    changes: [
      {
        op: 'insertText',
        offset: 11,
        text: 'access '
      }
    ],
    segments: [
      { type: 'equal', text: 'Remove the ' },
      { type: 'insert', text: 'access ' },
      { type: 'equal', text: 'panel.' }
    ]
  },
  {
    op: 'addNode',
    path: '/procedure[0]/step[@id="s2"][1]',
    value: {
      type: 'element',
      name: 'step',
      attrs: { id: 's2' },
      children: [{ type: 'text', text: 'Inspect the connector.' }]
    }
  }
]
```

## Public API

```ts
parseXml(xml)
normalizeXml(node, options)
diffXml(oldXmlOrNode, newXmlOrNode, options)
patchXml(xmlOrNode, ops, options)
serializeXml(node, options)
formatDiff(ops, options)
diffText(oldValue, newValue)
```

## Diff operations

The first version focuses on structured XML changes:

- `addNode`
- `removeNode`
- `replaceNode`
- `moveNode`
- `replaceText`
- `addAttr`
- `updateAttr`
- `removeAttr`

Text changes are represented as nested range operations inside `replaceText`.

## Options

```ts
interface XmlDiffOptions {
  ignoreWhitespaceText?: boolean;
  trimText?: boolean;
  ignoreComments?: boolean;
  sortAttributes?: boolean;
  keyAttrs?: string[];
  detectMoves?: boolean;
}
```

`keyAttrs` lets the diff engine align sibling elements by stable identifiers, such as `id`, `xml:id`, or domain-specific keys.

`detectMoves` is opt-in. When enabled, keyed sibling reorder changes are reported as `moveNode` operations. It is disabled by default so patching remains conservative for the first version.

## Release

This package is prepared for npm publishing with dual ESM/CJS output and generated TypeScript declarations.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm publish --access public
```

The repository also includes a GitHub Actions publish workflow. Configure `NPM_TOKEN` in repository secrets before using it.

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
