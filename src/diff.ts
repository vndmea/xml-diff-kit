import { normalizeXml } from './normalize.js';
import { parseXml } from './parse.js';
import { diffText } from './text-diff.js';
import type { XmlDiffOp, XmlDiffOptions, XmlNode } from './types.js';
import { formatPathSegment, getNodeKey } from './utils.js';

type IndexedNode = {
  node: XmlNode;
  index: number;
};

type ChildDiffPlan = {
  compareOps: XmlDiffOp[];
  removeOps: XmlDiffOp[];
  moveOps: XmlDiffOp[];
  addOps: XmlDiffOp[];
};

/**
 * Compare two XML inputs and return structured, machine-readable operations.
 *
 * Inputs can be raw XML strings or pre-parsed `XmlNode` ASTs. Both sides are
 * normalized before comparison, so options such as `ignoreWhitespaceText` and
 * `ignoreComments` are applied consistently to old and new documents.
 *
 * The returned operations use absolute paths from the XML root node. The path
 * format is intentionally deterministic and readable, for example:
 * `/procedure[0]/step[@id="s1"][0]/text()[0]`.
 */
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

/** Compare two nodes that are expected to represent the same path. */
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

  // Different element names or namespace URIs are treated as whole-node replacement.
  // This keeps the first version simple and avoids ambiguous rename semantics.
  if (oldNode.name !== newNode.name || oldNode.namespaceURI !== newNode.namespaceURI) {
    ops.push({ op: 'replaceNode', path, oldValue: oldNode, newValue: newNode });
    return;
  }

  diffAttributes(oldNode.attrs, newNode.attrs, path, ops);
  diffChildren(oldNode.children, newNode.children, path, options, ops);
}

/** Compare attribute maps on the same element path. */
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

/**
 * Compare child nodes.
 *
 * If `keyAttrs` is provided and at least one sibling has a key, keyed children
 * are aligned by key first. This reduces false positives for document models
 * where stable IDs are more meaningful than sibling indexes. Unkeyed children
 * still fall back to index-based comparison.
 */
function diffChildren(
  oldChildren: XmlNode[],
  newChildren: XmlNode[],
  parentPath: string,
  options: XmlDiffOptions,
  ops: XmlDiffOp[],
): void {
  const keyAttrs = options.keyAttrs ?? [];

  if (keyAttrs.length > 0) {
    const oldEntries = oldChildren.map((node, index) => ({ node, index }));
    const newEntries = newChildren.map((node, index) => ({ node, index }));
    const oldKeyed = buildKeyedMap(oldEntries, keyAttrs);
    const newKeyed = buildKeyedMap(newEntries, keyAttrs);

    if (!oldKeyed.hasDuplicates && !newKeyed.hasDuplicates && (oldKeyed.map.size > 0 || newKeyed.map.size > 0)) {
      const plan = createChildDiffPlan();

      for (const [key, entry] of oldKeyed.map) {
        const next = newKeyed.map.get(key);
        const childPath = `${parentPath}/${formatPathSegment(entry.node, entry.index, keyAttrs)}`;

        if (!next) {
          plan.removeOps.push({ op: 'removeNode', path: childPath, oldValue: entry.node });
          continue;
        }

        diffNode(entry.node, next.node, childPath, options, plan.compareOps);
      }

      for (const [key, entry] of newKeyed.map) {
        if (!oldKeyed.map.has(key)) {
          const childPath = `${parentPath}/${formatPathSegment(entry.node, entry.index, keyAttrs)}`;
          plan.addOps.push({ op: 'addNode', path: childPath, value: entry.node });
        }
      }

      if (options.detectMoves === true) {
        plan.moveOps.push(...buildMoveOps(oldEntries, newEntries, oldKeyed.map, newKeyed.map, parentPath, keyAttrs));
      }

      appendChildDiffPlan(
        plan,
        diffChildrenByIndex(
          oldEntries.filter(({ node }) => !getNodeKey(node, keyAttrs)),
          newEntries.filter(({ node }) => !getNodeKey(node, keyAttrs)),
          parentPath,
          options,
        ),
      );

      flushChildDiffPlan(plan, ops);
      return;
    }
  }

  flushChildDiffPlan(
    diffChildrenByIndex(
      oldChildren.map((node, index) => ({ node, index })),
      newChildren.map((node, index) => ({ node, index })),
      parentPath,
      options,
    ),
    ops,
  );
}

/** Compare child arrays by their current sibling indexes. */
function diffChildrenByIndex(
  oldChildren: IndexedNode[],
  newChildren: IndexedNode[],
  parentPath: string,
  options: XmlDiffOptions,
): ChildDiffPlan {
  const plan = createChildDiffPlan();
  const max = Math.max(oldChildren.length, newChildren.length);

  for (let index = 0; index < max; index += 1) {
    const oldItem = oldChildren[index];
    const newItem = newChildren[index];

    if (!oldItem && newItem) {
      const childPath = `${parentPath}/${formatPathSegment(newItem.node, newItem.index, options.keyAttrs)}`;
      plan.addOps.push({ op: 'addNode', path: childPath, value: newItem.node });
      continue;
    }

    if (oldItem && !newItem) {
      const childPath = `${parentPath}/${formatPathSegment(oldItem.node, oldItem.index, options.keyAttrs)}`;
      plan.removeOps.push({ op: 'removeNode', path: childPath, oldValue: oldItem.node });
      continue;
    }

    if (oldItem && newItem) {
      const childPath = `${parentPath}/${formatPathSegment(oldItem.node, oldItem.index, options.keyAttrs)}`;
      diffNode(oldItem.node, newItem.node, childPath, options, plan.compareOps);
    }
  }

  return plan;
}

function createChildDiffPlan(): ChildDiffPlan {
  return {
    compareOps: [],
    removeOps: [],
    moveOps: [],
    addOps: [],
  };
}

function appendChildDiffPlan(target: ChildDiffPlan, next: ChildDiffPlan): void {
  target.compareOps.push(...next.compareOps);
  target.removeOps.push(...next.removeOps);
  target.moveOps.push(...next.moveOps);
  target.addOps.push(...next.addOps);
}

function flushChildDiffPlan(plan: ChildDiffPlan, ops: XmlDiffOp[]): void {
  ops.push(...plan.compareOps);
  ops.push(...sortRemoveOps(plan.removeOps));
  ops.push(...plan.moveOps);
  ops.push(...sortAddOps(plan.addOps));
}

function sortRemoveOps(ops: XmlDiffOp[]): XmlDiffOp[] {
  return [...ops].sort((left, right) => getPathSortIndex(right.path) - getPathSortIndex(left.path));
}

function sortAddOps(ops: XmlDiffOp[]): XmlDiffOp[] {
  return [...ops].sort((left, right) => getPathSortIndex(left.path) - getPathSortIndex(right.path));
}

function getPathSortIndex(path: string): number {
  const matches = path.match(/\[(\d+)\]/g) ?? [];
  const lastMatch = matches.at(-1);

  return lastMatch ? Number.parseInt(lastMatch.slice(1, -1), 10) : -1;
}

function buildKeyedMap(entries: IndexedNode[], keyAttrs: string[]): {
  map: Map<string, IndexedNode>;
  hasDuplicates: boolean;
} {
  const map = new Map<string, IndexedNode>();
  let hasDuplicates = false;

  for (const entry of entries) {
    const key = getNodeKey(entry.node, keyAttrs);
    if (!key) continue;

    if (map.has(key)) {
      hasDuplicates = true;
      continue;
    }

    map.set(key, entry);
  }

  return {
    map,
    hasDuplicates,
  };
}

function buildMoveOps(
  oldEntries: IndexedNode[],
  newEntries: IndexedNode[],
  oldKeyed: Map<string, IndexedNode>,
  newKeyed: Map<string, IndexedNode>,
  parentPath: string,
  keyAttrs: string[],
): XmlDiffOp[] {
  const sharedKeys = new Set([...oldKeyed.keys()].filter((key) => newKeyed.has(key)));
  if (sharedKeys.size === 0) return [];

  let oldUnkeyedOrdinal = 0;
  let newUnkeyedOrdinal = 0;
  const current = oldEntries.filter(({ node }) => {
    const key = getNodeKey(node, keyAttrs);
    if (key) {
      return sharedKeys.has(key);
    }

    const keep = oldUnkeyedOrdinal < countUnkeyedRetained(oldEntries, newEntries, keyAttrs);
    oldUnkeyedOrdinal += 1;
    return keep;
  });
  const target = newEntries.filter(({ node }) => {
    const key = getNodeKey(node, keyAttrs);
    if (key) {
      return sharedKeys.has(key);
    }

    const keep = newUnkeyedOrdinal < countUnkeyedRetained(newEntries, oldEntries, keyAttrs);
    newUnkeyedOrdinal += 1;
    return keep;
  });
  const ops: XmlDiffOp[] = [];

  for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
    const targetEntry = target[targetIndex]!;
    const targetKey = getNodeKey(targetEntry.node, keyAttrs);
    if (!targetKey) continue;

    const currentKey = getNodeKey(current[targetIndex]?.node ?? targetEntry.node, keyAttrs);
    if (currentKey === targetKey) continue;

    const sourceIndex = current.findIndex((entry) => getNodeKey(entry.node, keyAttrs) === targetKey);
    if (sourceIndex === -1) continue;

    const sourceEntry = oldKeyed.get(targetKey);
    if (!sourceEntry) continue;

    const fromPath = `${parentPath}/${formatPathSegment(sourceEntry.node, sourceEntry.index, keyAttrs)}`;
    ops.push({
      op: 'moveNode',
      path: fromPath,
      fromPath,
      toPath: `${parentPath}/${formatPathSegment(targetEntry.node, targetIndex, keyAttrs)}`,
      value: targetEntry.node,
    });

    const [moved] = current.splice(sourceIndex, 1);
    if (moved) {
      current.splice(targetIndex, 0, moved);
    }
  }

  return ops;
}

function countUnkeyedRetained(sourceEntries: IndexedNode[], otherEntries: IndexedNode[], keyAttrs: string[]): number {
  const sourceUnkeyedCount = sourceEntries.filter(({ node }) => !getNodeKey(node, keyAttrs)).length;
  const otherUnkeyedCount = otherEntries.filter(({ node }) => !getNodeKey(node, keyAttrs)).length;

  return Math.min(sourceUnkeyedCount, otherUnkeyedCount);
}
