import { normalizeXml } from './normalize.js';
import { parseXml } from './parse.js';
import { serializeXml } from './serialize.js';
import type { SerializeOptions, XmlDiffOp, XmlNode } from './types.js';
import { cloneXmlNode } from './utils.js';

/** Internal target descriptor used while applying path-based operations. */
type PatchTarget = {
  /** The node selected by the operation path. */
  node: XmlNode;

  /** Parent element for non-root targets. Root targets intentionally omit this. */
  parent?: Extract<XmlNode, { type: 'element' }>;

  /** Index of `node` inside `parent.children`; root targets use index 0. */
  index: number;
};

export function patchXml(input: string, ops: XmlDiffOp[], options?: SerializeOptions): string;
export function patchXml(input: XmlNode, ops: XmlDiffOp[], options?: SerializeOptions): XmlNode;
/**
 * Apply structured diff operations to an XML string or AST.
 *
 * When the input is a string, the result is serialized XML. When the input is an
 * `XmlNode`, the result is a patched `XmlNode`. The input is cloned before any
 * operation is applied, so callers do not need to worry about accidental
 * mutation of their original XML AST.
 *
 * Patch application uses the absolute path information stored in each operation.
 * The current path parser reads numeric `[index]` parts and ignores optional
 * key hints such as `[@id="s1"]`; those hints are useful for readability and
 * alignment during diffing, while the numeric indexes remain the executable
 * addressing component for patching.
 */
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

/** Apply one operation to the mutable cloned root node. */
function applyOp(root: XmlNode, op: XmlDiffOp): void {
  if (op.op === 'replaceNode' && isRootPath(op.path)) {
    Object.assign(root, cloneXmlNode(op.newValue));
    return;
  }

  // The added node does not exist in the old tree, so resolving op.path first
  // would fail. Resolve the parent path instead, then insert at the final index.
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

/** Move an existing node from one absolute path to another. */
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

/** Resolve an absolute XML path to a node and, when applicable, its parent. */
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

  // The first numeric index belongs to the root path segment. Since `root` is
  // already selected, traversal starts from the second index.
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

/** Extract all numeric `[index]` parts from a path. */
function getPathIndexes(path: string): number[] {
  const matches = path.match(/\[(\d+)\]/g) ?? [];
  return matches.map((match) => Number.parseInt(match.slice(1, -1), 10));
}

/** Return the final numeric path index, usually the insertion or target index. */
function getLastIndex(path: string): number {
  const indexes = getPathIndexes(path);
  const index = indexes.at(-1);

  if (index === undefined) {
    throw new Error(`Path has no numeric index: ${path}`);
  }

  return index;
}

/** Return the absolute parent path for a node path. */
function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);

  if (parts.length <= 1) {
    return path;
  }

  return `/${parts.slice(0, -1).join('/')}`;
}

/** A root path has exactly one path segment, for example `/root[0]`. */
function isRootPath(path: string): boolean {
  return path.split('/').filter(Boolean).length === 1;
}

/** Type guard used before mutating element-only fields such as attrs/children. */
function assertElement(node: XmlNode, path: string): asserts node is Extract<XmlNode, { type: 'element' }> {
  if (node.type !== 'element') {
    throw new Error(`Expected element node at path: ${path}`);
  }
}
