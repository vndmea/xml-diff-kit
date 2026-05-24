export { diffXml } from './diff.js';
export { formatDiff } from './format.js';
export { normalizeXml } from './normalize.js';
export { parseXml } from './parse.js';
export { patchXml } from './patch.js';
export { serializeXml } from './serialize.js';
export { diffText } from './text-diff.js';

export type {
  DiffSummaryItem,
  FormatDiffOptions,
  SerializeOptions,
  TextChange,
  TextDiffSegment,
  XmlCommentNode,
  XmlDiffOp,
  XmlDiffOptions,
  XmlElementNode,
  XmlNode,
  XmlTextNode,
} from './types.js';
