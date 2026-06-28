import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { extract } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const load = (name: string, url: string) =>
  new JSDOM(readFileSync(join(here, 'fixtures', name), 'utf8'), { url }).window.document;

test('docs page: keeps the article, drops nav and footer', () => {
  const { markdown } = extract(load('docs-article.html', 'https://acme.com/docs/install'));
  expect(markdown).toContain('## Configuration');
  expect(markdown).toContain('[options reference](https://acme.com/docs/options)');
  expect(markdown).not.toContain('CHROME_NAV');
  expect(markdown).not.toContain('FOOTER_LEGAL');
});

test('messy marketing page: selector targets the real content, drops junk', () => {
  const { markdown } = extract(load('marketing-messy.html', 'https://acme.com/'), { content: '#content' });
  expect(markdown).toContain('## Why Acme');
  expect(markdown).not.toContain('NAV_JUNK');
  expect(markdown).not.toContain('COOKIE_JUNK');
});
