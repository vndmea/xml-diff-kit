import { normalizeXml } from './normalize.js';
import { parseXml } from './parse.js';
import { diffText } from './text-diff.js';
import type { XmlDiffOp, XmlDiffOptions, XmlNode } from './types.js';
import { formatPathSegment, getNodeKey } from './utils.js';

export function diffXml(
  oldInput: string | XmlNode,
  newInput: string | XmlNode,
  options: XmlDiffOptions = {},
): XmlDiffOp[] {
  const oldNode = normalizeXml(typeof oldInput === 'string' ? parseXml(oldInput) : oldInput, options);
  const newNode = normalizeXml(typeof newInput === 'string' ? parseXml(newInput) : newInput, options);

  const ops: XmlDiffOp[] = [];
  diffNode(oldNode, newNode, `/${formatPathSegment(oldNode, 0, options.keyAttrs)}`, options, ops);
  return ops;
}

function diffNode(
  oldNode: XmlNode,
  newNode: XmlNode,
  path: string,
  options: XmlDiffOptions,
  ops: XmlDiffOp[],
): void {
  if (oldNode.type !== newNode.type) {
    ops.push({ op: 'replaceNode', path, oldValue: oldNode, newValue: newNode });
    return;
  }

  if (oldNode.type === 'text' && newNode.type === 'text') {
    if (oldNode.text !== newNode.text) {
      const textDiff = diffText(oldNode.text, newNode.text);
      ops.push({
        op: 'replaceText',
        path,
        oldValue: oldNode.text,
        newValue: newNode.text,
        changes: textDiff.changes,
        segments: textDiff.segments,
      });
    }
    return;
  }

  if (oldNode.type === 'comment' && newNode.type === 'comment') {
    if (oldNode.text !== newNode.text) {
      ops.push({ op: 'replaceNode', path, oldValue: oldNode, newValue: newNode });
    }
    return;
  }

  if (oldNode.type !== 'element' || newNode.type !== 'element') return;

  if (oldNode.name !== newNode.name || oldNode.namespaceURI !== newNode.namespaceURI) {
    ops.push({ op: 'replaceNode', path, oldValue: oldNode, newValue: newNode });
    return;
  }

  diffAttributes(oldNode.attrs, newNode.attrs, path, ops);
  diffChildren(oldNode.children, newNode.children, path, options, ops);
}

function diffAttributes(
  oldAttrs: Record<string, string>,
  newAttrs: Record<string, string>,
  path: string,
  ops: XmlDiffOp[],
): void {
  for (const [name, oldValue] of Object.entries(oldAttrs)) {
    const newValue = newAttrs[name];

    if (newValue === undefined) {
      ops.push({ op: 'removeAttr', path, name, oldValue });
    } else if (newValue !== oldValue) {
      ops.push({ op: 'updateAttr', path, name, oldValue, newValue });
    }
  }

  for (const [name, value] of Object.entries(newAttrs)) {
    if (oldAttrs[name] === undefined) {
      ops.push({ op: 'addAttr', path, name, value });
    }
  }
}

function diffChildren(
  oldChildren: XmlNode[],
  newChildren: XmlNode[],
  parentPath: string,
  options: XmlDiffOptions,
  ops: XmlDiffOp[],
): void {
  const keyAttrs = options.keyAttrs ?? [];

  if (keyAttrs.length > 0) {
    const oldKeyed = new Map<string, { node: XmlNode; index: number }>();
    const newKeyed = new Map<string, { node: XmlNode; index: number }>();

    oldChildren.forEach((node, index) => {
      const key = getNodeKey(node, keyAttrs);
      if (key) oldKeyed.set(key, { node, index });
    });

    newChildren.forEach((node, index) => {
      const key = getNodeKey(node, keyAttrs);
      if (key) newKeyed.set(key, { node, index });
    });

    if (oldKeyed.size > 0 || newKeyed.size > 0) {
      for (const [key, { node, index }] of oldKeyed) {
        const next = newKeyed.get(key);
        const childPath = `${parentPath}/${formatPathSegment(node, index, keyAttrs)}`;

        if (!next) {
          ops.push({ op: 'removeNode', path: childPath, oldValue: node });
        } else {
          const newPath = `${parentPath}/${formatPathSegment(next.node, next.index, keyAttrs)}`;

          if ((options.detectMoves ?? true) && index !== next.index) {
            ops.push({
              op: 'moveNode',
              path: childPath,
              fromPath: childPath,
              toPath: newPath,
              value: next.node,
            });
          }

          diffNode(node, next.node, childPath, options, ops);
        }
      }

      for (const [, { node, index }] of newKeyed) {
        const key = getNodeKey(node, keyAttrs);
        if (key && !oldKeyed.has(key)) {
          const childPath = `${parentPath}/${formatPathSegment(node, index, keyAttrs)}`;
          ops.push({ op: 'addNode', path: childPath, value: node });
        }
      }

      const oldUnkeyed = oldChildren
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => !getNodeKey(node, keyAttrs));
      const newUnkeyed = newChildren
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => !getNodeKey(node, keyAttrs));

      diffChildrenByIndex(oldUnkeyed, newUnkeyed, parentPath, options, ops);
      return;
    }
  }

  diffChildrenByIndex(
    oldChildren.map((node, index) => ({ node, index })),
    newChildren.map((node, index) => ({ node, index })),
    parentPath,
    options,
    ops,
  );
}

function diffChildrenByIndex(
  oldChildren: Array<{ node: XmlNode; index: number }>,
  newChildren: Array<{ node: XmlNode; index: number }>,
  parentPath: string,
  options: XmlDiffOptions,
  ops: XmlDiffOp[],
): void {
  const max = Math.max(oldChildren.length, newChildren.length);

  for (let index = 0; index < max; index += 1) {
    const oldItem = oldChildren[index];
    const newItem = newChildren[index];

    if (!oldItem && newItem) {
      const childPath = `${parentPath}/${formatPathSegment(newItem.node, newItem.index, options.keyAttrs)}`;
      ops.push({ op: 'addNode', path: childPath, value: newItem.node });
      continue;
    }

    if (oldItem && !newItem) {
      const childPath = `${parentPath}/${formatPathSegment(oldItem.node, oldItem.index, options.keyAttrs)}`;
      ops.push({ op: 'removeNode', path: childPath, oldValue: oldItem.node });
      continue;
    }

    if (oldItem && newItem) {
      const childPath = `${parentPath}/${formatPathSegment(oldItem.node, oldItem.index, options.keyAttrs)}`;
      diffNode(oldItem.node, newItem.node, childPath, options, ops);
    }
  }
}
