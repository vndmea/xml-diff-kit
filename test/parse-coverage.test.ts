import { afterEach, describe, expect, it, vi } from 'vitest';

type ParserErrorHandler = {
  warning: (message: string) => void;
  error: (message: string) => void;
  fatalError: (message: string) => void;
};

type ParserOptions = {
  errorHandler: ParserErrorHandler;
};

type MockDocument = {
  documentElement: unknown;
};

async function loadParseXmlWithMockedDomParser() {
  vi.resetModules();

  vi.doMock('@xmldom/xmldom', () => {
    class DOMParser {
      readonly options: ParserOptions;

      constructor(options: ParserOptions) {
        this.options = options;
      }

      parseFromString(input: string): MockDocument {
        if (input === 'warning') {
          this.options.errorHandler.warning('parser warning');
        }

        if (input === 'error') {
          this.options.errorHandler.error('parser error');
        }

        if (input === 'fatal') {
          this.options.errorHandler.fatalError('parser fatal error');
        }

        if (input === 'missing-root') {
          return {
            documentElement: null,
          };
        }

        if (input === 'unsupported-root') {
          return {
            documentElement: {
              nodeType: 7,
            },
          };
        }

        return {
          documentElement: {
            nodeType: 1,
            nodeName: 'root',
            namespaceURI: null,
            attributes: {
              length: 0,
              item: () => null,
            },
            childNodes: {
              length: 0,
              item: () => null,
            },
          },
        };
      }
    }

    return {
      DOMParser,
    };
  });

  const module = await import('../src/parse.js');
  return module.parseXml;
}

afterEach(() => {
  vi.doUnmock('@xmldom/xmldom');
  vi.resetModules();
});

describe('parseXml defensive branches', () => {
  it('treats parser warning, error, and fatalError callbacks as invalid XML', async () => {
    const parseXml = await loadParseXmlWithMockedDomParser();

    expect(() => parseXml('warning')).toThrow('Invalid XML: parser warning');
    expect(() => parseXml('error')).toThrow('Invalid XML: parser error');
    expect(() => parseXml('fatal')).toThrow('Invalid XML: parser fatal error');
  });

  it('throws when the parser returns no document element', async () => {
    const parseXml = await loadParseXmlWithMockedDomParser();

    expect(() => parseXml('missing-root')).toThrow('Invalid XML: missing document element.');
  });

  it('throws when the root DOM node type is unsupported', async () => {
    const parseXml = await loadParseXmlWithMockedDomParser();

    expect(() => parseXml('unsupported-root')).toThrow('Unsupported XML node type: 7');
  });
});
