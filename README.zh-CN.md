# xml-diff-kit

[English](https://github.com/vndmea/xml-diff-kit/blob/master/README.md) | 简体中文

一个 TypeScript XML 差异工具包，用于解析、标准化、比较、补丁应用、序列化和格式化 XML 文档变更。

`xml-diff-kit` 面向需要**结构化、机器可读 XML 差异数据**的场景，而不是面向可视化文本对比。它适合结构化编辑器、审阅流程、变更追踪、补丁应用、XML 文档比较，以及浏览器端 XML 工具。

它可以在 Node.js 和现代浏览器中使用。包同时提供 ESM 和 CJS 产物，公共 API 不依赖 Node.js 专属运行时能力。

## 安装

```bash
npm install xml-diff-kit
```

## 使用方式

下面大部分示例共用同一组 XML：

```ts
const oldXml = '<procedure><step id="s1">Remove the panel.</step></procedure>';
const newXml = '<procedure><step id="s1">Remove the access panel.</step><step id="s2">Inspect.</step></procedure>';
```

### `diffXml`

比较两个 XML 文档，输出结构化 diff operations。

```ts
import { diffXml } from 'xml-diff-kit';

const ops = diffXml(oldXml, newXml, {
  keyAttrs: ['id'],
});

console.log(ops);
```

输出：

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

把结构化 diff operations 应用回 XML 字符串或已解析的 XML 节点。

`patchXml` 适合在拿到 diff 结果后，把旧 XML 转换成更新后的 XML。常见流程是：

```txt
diffXml(oldXml, newXml) -> XmlDiffOp[]
patchXml(oldXml, ops) -> patched XML
```

当输入是 XML 字符串时，`patchXml` 返回字符串。当输入是 `XmlNode` 时，它返回补丁后的 `XmlNode`。

```ts
import { diffXml, patchXml } from 'xml-diff-kit';

const ops = diffXml(oldXml, newXml, { keyAttrs: ['id'] });
const patchedXml = patchXml(oldXml, ops);

console.log(patchedXml);
```

输出：

```xml
<procedure><step id="s1">Remove the access panel.</step><step id="s2">Inspect.</step></procedure>
```

也可以在 patch XML 字符串时输出格式化后的 XML：

```ts
const prettyXml = patchXml(oldXml, ops, { pretty: true });

console.log(prettyXml);
```

输出：

```xml
<procedure>
  <step id="s1">Remove the access panel.</step>
  <step id="s2">Inspect.</step>
</procedure>
```

`patchXml` 根据路径应用变更。路径中的数字索引是实际用于定位节点的部分。类似 `[@id="s1"]` 的 key 提示用于提升可读性，并帮助 `diffXml` 对齐节点，但 patch 时仍然依赖数字索引。

支持的 patch 操作包括：

- 新增、删除、替换、移动节点
- 新增、更新、删除属性
- 替换文本节点内容

### `formatDiff`

把结构化 diff operations 格式化为摘要对象，或者 Markdown 报告。

```ts
import { diffXml, formatDiff } from 'xml-diff-kit';

const ops = diffXml(oldXml, newXml, { keyAttrs: ['id'] });
const summary = formatDiff(ops);

console.log(summary);
```

输出：

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

Markdown 输出：

```ts
const markdown = formatDiff(ops, { format: 'markdown' });

console.log(markdown);
```

输出：

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

### `parseXml` 和 `serializeXml`

把 XML 解析为内部 AST，再序列化回 XML 字符串。

```ts
import { parseXml, serializeXml } from 'xml-diff-kit';

const doc = parseXml('<root><item id="1">Hello</item><item id="2">World</item></root>');
const xml = serializeXml(doc, { pretty: true });

console.log(xml);
```

输出：

```xml
<root>
  <item id="1">Hello</item>
  <item id="2">World</item>
</root>
```

### `normalizeXml`

在 diff 或自定义处理前，标准化 XML AST。

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

输出：

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

直接比较两个文本值。`replaceText` 操作内部使用的就是同一套文本 diff。

```ts
import { diffText } from 'xml-diff-kit';

const textDiff = diffText('Remove the panel.', 'Remove the access panel.');

console.log(textDiff);
```

输出：

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

## Diff 操作类型

支持的结构化 XML 变更：

- `addNode`
- `removeNode`
- `replaceNode`
- `moveNode`
- `replaceText`
- `addAttr`
- `updateAttr`
- `removeAttr`

文本变更会作为 `replaceText` 内部的 range 操作表达。

## 选项

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

`keyAttrs` 用于让 diff 引擎通过稳定标识对齐兄弟元素，例如 `id`、`xml:id` 或业务自定义 key。

`detectMoves` 是可选能力。启用后，带 key 的兄弟节点重排会被报告为 `moveNode`。默认关闭，以保持 patch 行为保守。

## 路径说明

Diff operations 使用从 XML 根节点开始的绝对路径：

```txt
/procedure[0]/step[@id="s1"][0]/text()[0]
```

数字索引是 `patchXml` 实际用于定位节点的部分。类似 `[@id="s1"]` 的 key 提示用于提升可读性，并辅助 keyed matching。

## 开发

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
```

## 发布

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
