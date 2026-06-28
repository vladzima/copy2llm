import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { extract } from '../src/index';
import { toMarkdown } from '../src/to-markdown';

function doc(html: string, url = 'https://example.com/') {
  return new JSDOM(html, { url }).window.document;
}

function node(html: string) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document.body;
}

test('F1: a giant inline data: URI is not inlined verbatim', () => {
  const big = 'A'.repeat(50000);
  const { markdown } = extract(
    doc(
      `<body><article id="c"><img src="data:image/png;base64,${big}" alt="chart"></article></body>`,
    ),
    { content: '#c', header: false },
  );
  // The base64 payload must not be inlined.
  expect(markdown).not.toContain(big);
  expect(markdown.length).toBeLessThan(200);
  // The alt text is preserved.
  expect(markdown).toContain('chart');
});

test('F2: a header-less table converts to GFM instead of leaking raw HTML', () => {
  const { markdown } = extract(
    doc(
      '<body><article id="c"><table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table></article></body>',
    ),
    { content: '#c', header: false },
  );
  expect(markdown).not.toContain('<table');
  expect(markdown).not.toContain('<td>');
  expect(markdown).toContain('| a | b |');
  expect(markdown).toContain('| c | d |');
});

test('F3: the selector path strips script/style/noscript content', () => {
  const { markdown } = extract(
    doc(
      '<body><div id=c><script>var secret="leaked";</script><style>.a{color:red}</style><p>visible</p></div></body>',
    ),
    { content: '#c', header: false },
  );
  expect(markdown).not.toContain('leaked');
  expect(markdown).not.toContain('color:red');
  expect(markdown).toContain('visible');
});

test('F6: cleanup preserves blank lines and trailing whitespace inside code fences', () => {
  const md = toMarkdown(
    node('<pre><code>def a():\n    pass\n\n\ndef b():\n    pass</code></pre>'),
  );
  // The two consecutive blank lines between functions must survive.
  expect(md).toContain('pass\n\n\ndef b');

  const md2 = toMarkdown(node('<pre><code>line with trailing   \nx</code></pre>'));
  expect(md2).toContain('line with trailing   \n');
});
