# xml-diff-kit

语言： [English](https://github.com/vndmea/xml-diff-kit/blob/master/README.md) | [简体中文](https://github.com/vndmea/xml-diff-kit/blob/master/README.zh-CN.md)

一个 TypeScript XML 差异工具包，用于解析、标准化、比较、补丁应用和格式化 XML 文档变更。

`xml-diff-kit` 面向需要**结构化差异数据**的场景，而不是面向可视化文本对比。它适合结构化编辑器、审阅流程、变更追踪、补丁应用、XML 文档版本比较等场景。

## 安装

```bash
pnpm add xml-diff-kit
```

## 快速使用

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

## 示例输出

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

## 公共 API

```ts
parseXml(xml)
normalizeXml(node, options)
diffXml(oldXmlOrNode, newXmlOrNode, options)
patchXml(xmlOrNode, ops, options)
serializeXml(node, options)
formatDiff(ops, options)
diffText(oldValue, newValue)
```

## Diff 操作类型

当前版本聚焦结构化 XML 变更：

- `addNode`
- `removeNode`
- `replaceNode`
- `moveNode`
- `replaceText`
- `addAttr`
- `updateAttr`
- `removeAttr`

文本变更会作为 `replaceText` 内部的 range 操作表达，包括 `changes` 和 `segments`。

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

`detectMoves` 是可选能力。启用后，带 key 的兄弟节点重排会被报告为 `moveNode`。默认关闭，这样第一版的 patch 行为更保守、更稳定。

## 路径说明

差异操作中的 `path`、`fromPath`、`toPath` 表示 XML 树中的节点路径，例如：

```txt
/procedure[0]/step[@id="s1"][0]/text()[0]
```

这表示根节点 `procedure` 下第 0 个 `step`，并且该 `step` 的 `id` 为 `s1`，然后定位到第 0 个文本节点。

## 发布

该包已按 npm 发布准备，支持 ESM/CJS 双格式输出，并生成 TypeScript 声明文件。

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm publish --access public
```

仓库也包含 GitHub Actions 发布 workflow。发布前需要在仓库 secrets 中配置 `NPM_TOKEN`。

## 开发

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
