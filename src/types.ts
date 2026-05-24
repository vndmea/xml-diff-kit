export type XmlNode = XmlElementNode | XmlTextNode | XmlCommentNode;

export interface XmlElementNode {
  type: 'element';
  name: string;
  namespaceURI?: string | null;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export interface XmlTextNode {
  type: 'text';
  text: string;
}

export interface XmlCommentNode {
  type: 'comment';
  text: string;
}

export interface XmlDiffOptions {
  ignoreWhitespaceText?: boolean;
  trimText?: boolean;
  ignoreComments?: boolean;
  sortAttributes?: boolean;
  keyAttrs?: string[];
  detectMoves?: boolean;
}

export interface SerializeOptions {
  pretty?: boolean;
  indent?: string;
}

export type TextChange =
  | {
      op: 'insertText';
      offset: number;
      text: string;
    }
  | {
      op: 'deleteText';
      offset: number;
      oldText: string;
    }
  | {
      op: 'replaceTextRange';
      offset: number;
      oldText: string;
      newText: string;
    };

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

export type XmlDiffOp =
  | {
      op: 'addNode';
      path: string;
      value: XmlNode;
    }
  | {
      op: 'removeNode';
      path: string;
      oldValue: XmlNode;
    }
  | {
      op: 'replaceNode';
      path: string;
      oldValue: XmlNode;
      newValue: XmlNode;
    }
  | {
      op: 'moveNode';
      path: string;
      fromPath: string;
      toPath: string;
      value: XmlNode;
    }
  | {
      op: 'replaceText';
      path: string;
      oldValue: string;
      newValue: string;
      changes: TextChange[];
      segments: TextDiffSegment[];
    }
  | {
      op: 'addAttr';
      path: string;
      name: string;
      value: string;
    }
  | {
      op: 'updateAttr';
      path: string;
      name: string;
      oldValue: string;
      newValue: string;
    }
  | {
      op: 'removeAttr';
      path: string;
      name: string;
      oldValue: string;
    };

export interface FormatDiffOptions {
  format?: 'summary' | 'markdown';
}

export interface DiffSummaryItem {
  type:
    | 'nodeAdded'
    | 'nodeRemoved'
    | 'nodeReplaced'
    | 'nodeMoved'
    | 'textChanged'
    | 'attrAdded'
    | 'attrUpdated'
    | 'attrRemoved';
  path: string;
  message: string;
  before?: unknown;
  after?: unknown;
}
