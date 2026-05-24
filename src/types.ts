/**
 * A normalized XML node used by xml-diff-kit.
 *
 * The library intentionally uses a small custom AST instead of exposing DOM nodes.
 * This keeps diff operations serializable, easy to store, and usable in both
 * Node.js and browser runtimes.
 */
export type XmlNode = XmlElementNode | XmlTextNode | XmlCommentNode;

/**
 * Normalized XML element node.
 *
 * `name` currently preserves the parsed element name, including any prefix
 * exposed by the XML parser. `namespaceURI` is normalized to `null` when the
 * parser does not provide a namespace URI, which makes equality checks stable.
 */
export interface XmlElementNode {
  /** Discriminator used by TypeScript union narrowing. */
  type: 'element';

  /** Element name as parsed from XML, for example `procedure`, `step`, or `rdf:Description`. */
  name: string;

  /** Namespace URI when available; `null` when the element has no namespace. */
  namespaceURI?: string | null;

  /** Attribute map. Attribute order is not represented semantically. */
  attrs: Record<string, string>;

  /** Child nodes in document order. XML element order is treated as significant by default. */
  children: XmlNode[];
}

/** Normalized XML text node. */
export interface XmlTextNode {
  /** Discriminator used by TypeScript union narrowing. */
  type: 'text';

  /** Raw text content after optional normalization. */
  text: string;
}

/** Normalized XML comment node. */
export interface XmlCommentNode {
  /** Discriminator used by TypeScript union narrowing. */
  type: 'comment';

  /** Comment body without `<!--` and `-->`. */
  text: string;
}

/** Options shared by parsing-normalization and diffing. */
export interface XmlDiffOptions {
  /** Drop text nodes that contain only whitespace after trimming. */
  ignoreWhitespaceText?: boolean;

  /** Trim leading and trailing whitespace from all text nodes before diffing. */
  trimText?: boolean;

  /** Drop XML comment nodes before diffing. */
  ignoreComments?: boolean;

  /** Sort attributes by name during normalization for deterministic output. */
  sortAttributes?: boolean;

  /**
   * Attribute names used to align sibling elements semantically.
   *
   * Without `keyAttrs`, child nodes are compared by index. With `keyAttrs`,
   * elements such as `<step id="s1"/>` can be matched by `id` even if their
   * sibling position changes.
   */
  keyAttrs?: string[];

  /**
   * Detect keyed sibling reorders as `moveNode` operations.
   *
   * This is opt-in because the current patch algorithm is conservative and the
   * safest default for early versions is to avoid changing node order unless the
   * caller explicitly asks for move detection.
   */
  detectMoves?: boolean;
}

/** Options used when serializing the normalized XML AST back to XML text. */
export interface SerializeOptions {
  /** Format nested element children across multiple lines. */
  pretty?: boolean;

  /** Indentation string used when `pretty` is enabled. Defaults to two spaces. */
  indent?: string;
}

/**
 * Fine-grained text patch inside a `replaceText` XML operation.
 *
 * Offsets are based on the old text value and measured by Unicode code points
 * through `Array.from`, not by UTF-16 code units. This makes offsets safer for
 * non-BMP characters such as emoji.
 */
export type TextChange =
  | {
      /** Insert text at `offset` in the old text. */
      op: 'insertText';
      offset: number;
      text: string;
    }
  | {
      /** Delete `oldText` starting at `offset` in the old text. */
      op: 'deleteText';
      offset: number;
      oldText: string;
    }
  | {
      /** Replace `oldText` with `newText` starting at `offset` in the old text. */
      op: 'replaceTextRange';
      offset: number;
      oldText: string;
      newText: string;
    };

/**
 * Display-oriented text diff segment.
 *
 * Segments are useful for rendering review UIs or markdown reports. They are
 * less convenient than `TextChange` for applying patches because they do not
 * carry explicit offsets.
 */
export type TextDiffSegment =
  | {
      type: 'equal';
      text: string;
    }
  | {
      type: 'insert';
      text: string;
    }
  | {
      type: 'delete';
      text: string;
    };

/**
 * Structured XML diff operation.
 *
 * All `path`, `fromPath`, and `toPath` values are absolute paths from the XML
 * root node, for example `/procedure[0]/step[@id="s1"][0]/text()[0]`.
 */
export type XmlDiffOp =
  | {
      /** Add a node at `path`. */
      op: 'addNode';
      path: string;
      value: XmlNode;
    }
  | {
      /** Remove the node at `path`. */
      op: 'removeNode';
      path: string;
      oldValue: XmlNode;
    }
  | {
      /** Replace the entire node at `path`. */
      op: 'replaceNode';
      path: string;
      oldValue: XmlNode;
      newValue: XmlNode;
    }
  | {
      /** Move a node from `fromPath` to `toPath`. */
      op: 'moveNode';
      path: string;
      fromPath: string;
      toPath: string;
      value: XmlNode;
    }
  | {
      /** Replace a text node value, with optional fine-grained text details. */
      op: 'replaceText';
      path: string;
      oldValue: string;
      newValue: string;
      changes: TextChange[];
      segments: TextDiffSegment[];
    }
  | {
      /** Add an attribute to the element at `path`. */
      op: 'addAttr';
      path: string;
      name: string;
      value: string;
    }
  | {
      /** Update an existing attribute on the element at `path`. */
      op: 'updateAttr';
      path: string;
      name: string;
      oldValue: string;
      newValue: string;
    }
  | {
      /** Remove an attribute from the element at `path`. */
      op: 'removeAttr';
      path: string;
      name: string;
      oldValue: string;
    };

/** Options for converting structured diff operations into human-readable output. */
export interface FormatDiffOptions {
  /** `summary` returns objects; `markdown` returns a markdown report string. */
  format?: 'summary' | 'markdown';
}

/** Human-readable summary item generated from an `XmlDiffOp`. */
export interface DiffSummaryItem {
  /** High-level operation category suitable for UI filtering. */
  type:
    | 'nodeAdded'
    | 'nodeRemoved'
    | 'nodeReplaced'
    | 'nodeMoved'
    | 'textChanged'
    | 'attrAdded'
    | 'attrUpdated'
    | 'attrRemoved';

  /** Absolute XML path associated with the change. */
  path: string;

  /** Short human-readable description. */
  message: string;

  /** Optional old value, path, or node, depending on operation type. */
  before?: unknown;

  /** Optional new value, path, or node, depending on operation type. */
  after?: unknown;
}
