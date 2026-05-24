# xml-diff-kit

English | [简体中文](https://github.com/vndmea/xml-diff-kit/blob/master/README.zh-CN.md)

A TypeScript toolkit for parsing, normalizing, diffing, patching, serializing, and formatting XML document changes.

`xml-diff-kit` is designed for applications that need structured, machine-readable XML differences rather than visual line-based diffs. It is suitable for structured editors, review workflows, change tracking, patch application, XML document comparison, and browser-based XML tooling.

It works in both Node.js and modern browsers. The package exports ESM and CJS builds, and the public API does not require Node.js-only runtime APIs.

## Install

```bash
npm install xml-diff-kit
```

## Usage

Most examples below use the same pair of XML documents:

```ts
const oldXml = '<procedure><step id="s1">Remove the panel.</step></procedure>';
const newXml = '<procedure><step id="s1">Remove the access panel.</step><step id="s2">Inspect.</step></procedure>';
```

### `diffXml`

Compare two XML documents and get structured diff operations.

```ts
import { diffXml } from 'xml-diff-kit';

const ops = diffXml(oldXml, newXml, {
  keyAttrs: ['id'],
});

console.log(ops);
```

Output:

```ts
[
  {
    op: 'replaceText',
    path: '/procedure[0]/step[@id="s1"][0]/text()[0]',
    oldValue: 'Remove the panel.',
    newValue: 'Remove the access panel.',
    changes: [{ op: 'insertText', offset: 11, text: 'access ' }],
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
      namespaceURI: null,
      attrs: { id: 's2' },
      children: [{ type: 'text', text: 'Inspect.' }]
    }
  }
]
```

### `patchXml`

Apply structured diff operations back to an XML string or a parsed XML node.

`patchXml` is useful when you want to turn a diff result into the updated XML document. A common flow is:

```txt
diffXml(oldXml, newXml) -> XmlDiffOp[]
patchXml(oldXml, ops) -> patched XML
```

When the input is an XML string, `patchXml` returns a string. When the input is an `XmlNode`, it returns a patched `XmlNode`.

```ts
import { diffXml, patchXml } from 'xml-diff-kit';

const ops = diffXml(oldXml, newXml, { keyAttrs: ['id'] });
const patchedXml = patchXml(oldXml, ops);

console.log(patchedXml);
```

Output:

```xml
<procedure><step id="s1">Remove the access panel.</step><step id="s2">Inspect.</step></procedure>
```

You can also request pretty output when patching XML strings:

```ts
const prettyXml = patchXml(oldXml, ops, { pretty: true });

console.log(prettyXml);
```

Output:

```xml
<procedure>
  <step id="s1">Remove the access panel.</step>
  <step id="s2">Inspect.</step>
</procedure>
```

`patchXml` applies operations by path. The numeric indexes in paths are the executable addressing part used to locate nodes. Key hints such as `[@id="s1"]` make paths easier to read and help `diffXml` align nodes, but patching still relies on the numeric indexes.

Supported patch operations include:

- adding, removing, replacing, and moving nodes
- adding, updating, and removing attributes
- replacing text node values

### `formatDiff`

Format structured diff operations as summary objects or a Markdown report.

```ts
import { diffXml, formatDiff } from 'xml-diff-kit';

const ops = diffXml(oldXml, newXml, { keyAttrs: ['id'] });
const summary = formatDiff(ops);

console.log(summary);
```

Output:

```ts
[
  {
    type: 'textChanged',
    path: '/procedure[0]/step[@id="s1"][0]/text()[0]',
    message: 'Changed text at /procedure[0]/step[@id="s1"][0]/text()[0]',
    before: 'Remove the panel.',
    after: 'Remove the access panel.'
  },
  {
    type: 'nodeAdded',
    path: '/procedure[0]/step[@id="s2"][1]',
    message: 'Added node at /procedure[0]/step[@id="s2"][1]',
    after: {
      type: 'element',
      name: 'step',
      namespaceURI: null,
      attrs: { id: 's2' },
      children: [{ type: 'text', text: 'Inspect.' }]
    }
  }
]
```

Markdown output:

```ts
const markdown = formatDiff(ops, { format: 'markdown' });

console.log(markdown);
```

Output:

````md
# XML Diff

Total changes: 2

## 1. Changed text

- Path: `/procedure[0]/step[@id="s1"][0]/text()[0]`

**Before**

```text
Remove the panel.
```

**After**

```text
Remove the access panel.
```

**Text segments**

- equal: `Remove the `
- insert: `access `
- equal: `panel.`

## 2. Added node

- Path: `/procedure[0]/step[@id="s2"][1]`

```xml
<step id="s2">Inspect.</step>
```
````

### `parseXml` and `serializeXml`

Parse XML into the internal AST, then serialize it back to XML.

```ts
import { parseXml, serializeXml } from 'xml-diff-kit';

const doc = parseXml('<root><item id="1">Hello</item><item id="2">World</item></root>');
const xml = serializeXml(doc, { pretty: true });

console.log(xml);
```

Output:

```xml
<root>
  <item id="1">Hello</item>
  <item id="2">World</item>
</root>
```

### `normalizeXml`

Normalize an XML AST before diffing or custom processing.

```ts
import { normalizeXml, parseXml } from 'xml-diff-kit';

const doc = parseXml('<root b="2" a="1">  <item> value </item>  </root>');

const normalized = normalizeXml(doc, {
  ignoreWhitespaceText: true,
  trimText: true,
  sortAttributes: true,
});

console.log(normalized);
```

Output:

```ts
{
  type: 'element',
  name: 'root',
  namespaceURI: null,
  attrs: { a: '1', b: '2' },
  children: [
    {
      type: 'element',
      name: 'item',
      namespaceURI: null,
      attrs: {},
      children: [{ type: 'text', text: 'value' }]
    }
  ]
}
```

### `diffText`

Diff two text values directly. This is the same text diff used inside `replaceText` operations.

```ts
import { diffText } from 'xml-diff-kit';

const textDiff = diffText('Remove the panel.', 'Remove the access panel.');

console.log(textDiff);
```

Output:

```ts
{
  changes: [{ op: 'insertText', offset: 11, text: 'access ' }],
  segments: [
    { type: 'equal', text: 'Remove the ' },
    { type: 'insert', text: 'access ' },
    { type: 'equal', text: 'panel.' }
  ]
}
```

## Diff operations

Supported structured XML changes:

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

`detectMoves` is opt-in. When enabled, keyed sibling reorder changes are reported as `moveNode` operations. It is disabled by default to keep patching behavior conservative.

## Paths

Diff operations use absolute paths from the XML root node:

```txt
/procedure[0]/step[@id="s1"][0]/text()[0]
```

The numeric index is the executable addressing part used by patching. Key hints such as `[@id="s1"]` improve readability and keyed matching.

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
```

## Release

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm publish --access public
```

## License

MIT
