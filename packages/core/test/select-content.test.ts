import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { selectContent } from '../src/select-content';

function doc(html: string, url = 'https://example.com/') {
  return new JSDOM(html, { url }).window.document;
}

test('an explicit selector wins over everything else', () => {
  const d = doc(
    '<html><head><title>T</title></head><body><nav>NAVTEXT</nav><section id="main"><p>PICKED</p></section></body></html>',
  );
  const { root, title } = selectContent(d, '#main');
  expect(root.textContent).toContain('PICKED');
  expect(root.textContent).not.toContain('NAVTEXT');
  expect(title).toBe('T');
});

test('extracts the main content when no selector is given', () => {
  // Behaviour assertion: content survives whether Readability or the <main> fallback produced it.
  const d = doc('<html><head><title>T</title></head><body><main><p>MAIN CONTENT</p></main></body></html>');
  const { root } = selectContent(d);
  expect(root.textContent).toContain('MAIN CONTENT');
});

test('falls back to <body> when there is no main/article and readability finds nothing', () => {
  const d = doc('<html><head><title>T</title></head><body><div><p>LOOSE</p></div></body></html>');
  const { root } = selectContent(d);
  expect(root.textContent).toContain('LOOSE');
});
