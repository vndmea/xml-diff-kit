import { normalizeXml } from './normalize.js';
import { parseXml } from './parse.js';
import { serializeXml } from './serialize.js';
import type { SerializeOptions, XmlDiffOp, XmlNode } from './types.js';
import { cloneXmlNode } from './utils.js';

type PatchTarget = {
  node: XmlNode;
  parent?: Extract<XmlNode, { type: 'element' }>;
  index: number;
};

export function patchXml(input: string, ops: XmlDiffOp[], options?: SerializeOptions): string;
export function patchXml(input: XmlNode, ops: XmlDiffOp[], options?: SerializeOptions): XmlNode;
export function patchXml(
  input: string | XmlNode,
  ops: XmlDiffOp[],
  options: SerializeOptions = {},
): string | XmlNode {
  const root = cloneXmlNode(typeof input === 'string' ? parseXml(input) : input);

  for (const op of ops) {
    applyOp(root, op);
  }

  const normalized = normalizeXml(root, { sortAttributes: true });

  if (typeof input === 'string') {
    return serializeXml(normalized, options);
  }

  return normalized;
}

function applyOp(root: XmlNode, op: XmlDiffOp): void {
  if (op.op === 'replaceNode' && isRootPath(op.path)) {
    Object.assign(root, cloneXmlNode(op.newValue));
    return;
  }

  if (op.op === 'addNode') {
    const parentPath = getParentPath(op.path);
    const parent = getTarget(root, parentPath).node;
    assertElement(parent, parentPath);
    const insertIndex = getLastIndex(op.path);
    parent.children.splice(insertIndex, 0, cloneXmlNode(op.value));
    return;
  }

  if (op.op === 'moveNode') {
    moveNode(root, op.fromPath, op.toPath);
    return;
  }

  const target = getTarget(root, op.path);

  switch (op.op) {
    case 'addAttr':
      assertElement(target.node, op.path);
      target.node.attrs[op.name] = op.value;
      break;

    case 'updateAttr':
      assertElement(target.node, op.path);
      target.node.attrs[op.name] = op.newValue;
      break;

    case 'removeAttr':
      assertElement(target.node, op.path);
      delete target.node.attrs[op.name];
      break;

    case 'replaceText':
      if (target.node.type !== 'text') {
        throw new Error(`Cannot replace text at non-text path: ${op.path}`);
      }
      target.node.text = op.newValue;
      break;

    case 'replaceNode':
      if (!target.parent) throw new Error('Cannot replace root node without root replace path.');
      target.parent.children[target.index] = cloneXmlNode(op.newValue);
      break;

    case 'removeNode':
      if (!target.parent) throw new Error('Cannot remove root node.');
      target.parent.children.splice(target.index, 1);
      break;
  }
}

function moveNode(root: XmlNode, fromPath: string, toPath: string): void {
  const source = getTarget(root, fromPath);

  if (!source.parent) {
    throw new Error('Cannot move root node.');
  }

  const [removed] = source.parent.children.splice(source.index, 1);
  if (!removed) {
    throw new Error(`Path not found: ${fromPath}`);
  }

  const parentPath = getParentPath(toPath);
  const targetParent = getTarget(root, parentPath).node;
  assertElement(targetParent, parentPath);

  const targetIndex = getLastIndex(toPath);
  targetParent.children.splice(targetIndex, 0, removed);
}

function getTarget(root: XmlNode, path: string): PatchTarget {
  const indexes = getPathIndexes(path);

  if (indexes.length === 0) {
    return {
      node: root,
      index: 0,
    };
  }

  let current = root;
  let parent: Extract<XmlNode, { type: 'element' }> | undefined;
  let currentIndex = 0;

  for (const index of indexes.slice(1)) {
    assertElement(current, path);
    parent = current;
    currentIndex = index;

    const child = current.children[index];
    if (!child) {
      throw new Error(`Path not found: ${path}`);
    }

    current = child;
  }

  const result: PatchTarget = {
    node: current,
    index: currentIndex,
  };

  if (parent) {
    result.parent = parent;
  }

  return result;
}

function getPathIndexes(path: string): number[] {
  const matches = path.match(/\[(\d+)\]/g) ?? [];
  return matches.map((match) => Number.parseInt(match.slice(1, -1), 10));
}

function getLastIndex(path: string): number {
  const indexes = getPathIndexes(path);
  const index = indexes.at(-1);

  if (index === undefined) {
    throw new Error(`Path has no numeric index: ${path}`);
  }

  return index;
}

function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);

  if (parts.length <= 1) {
    return path;
  }

  return `/${parts.slice(0, -1).join('/')}`;
}

function isRootPath(path: string): boolean {
  return path.split('/').filter(Boolean).length === 1;
}

function assertElement(node: XmlNode, path: string): asserts node is Extract<XmlNode, { type: 'element' }> {
  if (node.type !== 'element') {
    throw new Error(`Expected element node at path: ${path}`);
  }
}
