#!/usr/bin/env node
/**
 * Static build step.
 *
 * Everything you are likely to want to change lives in /data as JSON. This
 * script merges that JSON into the HTML templates in /src/pages, compiles the
 * SCSS, copies the static assets, and writes a deploy-ready /dist folder.
 *
 * Nothing is fetched at runtime, so the pages are fully rendered in the HTML
 * that reaches the browser. That is what keeps the Lighthouse SEO and
 * performance numbers where they are.
 *
 *   node tools/build.js            build once
 *   node tools/build.js --watch    rebuild on change
 *
 * Template syntax (a deliberately tiny subset of Handlebars):
 *
 *   {{value}}             escaped output, dotted paths allowed (a.b.c)
 *   {{{value}}}           raw output, for strings that contain markup
 *   {{> partial}}         include src/partials/<partial>.html
 *   {{#each list}}…{{/each}}
 *                         iterate an array; inside the block the item is the
 *                         current scope, with @index, @number and @isFirst
 *   {{#if value}}…{{else}}…{{/if}}
 *                         truthy test (empty arrays count as false)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = {
  data: path.join(ROOT, 'data'),
  pages: path.join(ROOT, 'src', 'pages'),
  partials: path.join(ROOT, 'src', 'partials'),
  scss: path.join(ROOT, 'src', 'scss'),
  js: path.join(ROOT, 'src', 'js'),
  assets: path.join(ROOT, 'assets'),
  dist: path.join(ROOT, 'dist'),
};

/* ------------------------------------------------------------------ utils */

const read = (f) => fs.readFileSync(f, 'utf8');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/* -------------------------------------------------------------- templating */

/** Resolve "a.b.c" against the innermost scope that has it. */
function lookup(scopes, expr) {
  if (expr === '.' || expr === 'this') return scopes[scopes.length - 1];
  const parts = expr.replace(/^this\./, '').split('.');
  for (let i = scopes.length - 1; i >= 0; i -= 1) {
    let value = scopes[i];
    let ok = true;
    for (const part of parts) {
      if (value !== null && typeof value === 'object' && part in value) value = value[part];
      else { ok = false; break; }
    }
    if (ok) return value;
  }
  return undefined;
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/**
 * Find the index of the block tag that closes the one opened at `openEnd`.
 * Counts nesting so {{#each}} inside {{#each}} pairs up correctly, and reports
 * the position of a top-level {{else}} when there is one.
 */
function findBlockEnd(tpl, openEnd, keyword) {
  const re = new RegExp(`\\{\\{(#${keyword}|/${keyword}|else)[^}]*\\}\\}`, 'g');
  re.lastIndex = openEnd;
  let depth = 1;
  let elseAt = -1;
  let match;
  while ((match = re.exec(tpl)) !== null) {
    const tag = match[1];
    if (tag === `#${keyword}`) depth += 1;
    else if (tag === `/${keyword}`) {
      depth -= 1;
      if (depth === 0) return { bodyEnd: match.index, next: re.lastIndex, elseAt };
    } else if (tag === 'else' && depth === 1) {
      elseAt = match.index;
    }
  }
  throw new Error(`Unclosed {{#${keyword}}} block`);
}

function render(tpl, scopes, partials) {
  let out = '';
  let cursor = 0;
  const tagRe = /\{\{(\{?)\s*([#/>]?)\s*([^}]+?)\s*\}?\}\}/g;
  tagRe.lastIndex = 0;

  let match;
  while ((match = tagRe.exec(tpl)) !== null) {
    out += tpl.slice(cursor, match.index);
    const [full, brace, sigil, body] = match;

    if (sigil === '>') {
      const name = body.trim();
      if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
      out += render(partials[name], scopes, partials);
      cursor = tagRe.lastIndex;
      continue;
    }

    if (sigil === '#') {
      const [keyword, ...rest] = body.split(/\s+/);
      const expr = rest.join(' ').trim();

      if (keyword === 'each') {
        const { bodyEnd, next } = findBlockEnd(tpl, tagRe.lastIndex, 'each');
        const inner = tpl.slice(tagRe.lastIndex, bodyEnd);
        const list = lookup(scopes, expr);
        if (Array.isArray(list)) {
          list.forEach((item, index) => {
            const scope = (item !== null && typeof item === 'object') ? { ...item } : { value: item };
            scope['@index'] = index;
            scope['@number'] = index + 1;
            scope['@padded'] = String(index + 1).padStart(2, '0');
            scope['@isFirst'] = index === 0;
            scope['@isLast'] = index === list.length - 1;
            scope['@value'] = item;
            out += render(inner, scopes.concat([scope]), partials);
          });
        }
        cursor = next;
        tagRe.lastIndex = next;
        continue;
      }

      if (keyword === 'if') {
        const { bodyEnd, next, elseAt } = findBlockEnd(tpl, tagRe.lastIndex, 'if');
        const truthy = isTruthy(lookup(scopes, expr));
        let branch;
        if (elseAt >= 0) {
          branch = truthy
            ? tpl.slice(tagRe.lastIndex, elseAt)
            : tpl.slice(tpl.indexOf('}}', elseAt) + 2, bodyEnd);
        } else {
          branch = truthy ? tpl.slice(tagRe.lastIndex, bodyEnd) : '';
        }
        out += render(branch, scopes, partials);
        cursor = next;
        tagRe.lastIndex = next;
        continue;
      }

      throw new Error(`Unknown block helper: ${keyword}`);
    }

    const value = lookup(scopes, body);
    if (value !== undefined && value !== null && value !== false) {
      out += brace === '{' ? String(value) : escapeHtml(value);
    }
    cursor = tagRe.lastIndex;
  }

  return out + tpl.slice(cursor);
}

/* ------------------------------------------------------------------ build */

function loadData() {
  const data = {};
  for (const file of fs.readdirSync(DIR.data)) {
    if (!file.endsWith('.json')) continue;
    const key = path.basename(file, '.json');
    try {
      data[key] = JSON.parse(read(path.join(DIR.data, file)));
    } catch (err) {
      throw new Error(`${file} is not valid JSON - ${err.message}`);
    }
  }
  return data;
}

/**
 * Fields the templates need that would be noise to hand-maintain in JSON.
 * Keep this short - the point of the data files is that they stay readable to
 * someone who has never opened this script.
 */
function derive(data) {
  // a 5-slot array per review, so the template can just iterate it
  data.reviews?.items?.forEach((review) => {
    const score = Math.round(review.rating || 0);
    review.stars = Array.from({ length: 5 }, (_, i) => (i < score ? 1 : 0));
  });

  // "01", "02", … for the hero counter total
  if (data.hero?.slides) data.hero.total = String(data.hero.slides.length).padStart(2, '0');

  return data;
}

function loadPartials() {
  const partials = {};
  for (const file of fs.readdirSync(DIR.partials)) {
    if (file.endsWith('.html')) partials[path.basename(file, '.html')] = read(path.join(DIR.partials, file));
  }
  return partials;
}

/** Page templates carry their own metadata in a leading HTML comment. */
function splitFrontMatter(source, file) {
  const match = source.match(/^\s*<!--\s*page\s*([\s\S]*?)-->\s*/);
  if (!match) throw new Error(`${file} is missing its <!-- page { … } --> block`);
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`${file} front matter is not valid JSON - ${err.message}`);
  }
  return { meta, body: source.slice(match[0].length) };
}

function buildHtml(data, partials) {
  const pages = [];
  for (const file of fs.readdirSync(DIR.pages)) {
    if (!file.endsWith('.html')) continue;
    const { meta, body } = splitFrontMatter(read(path.join(DIR.pages, file)), file);

    const page = {
      ...meta,
      file,
      // mark the matching nav entry so the header can highlight it
    };
    const nav = data.site.nav.map((item) => ({ ...item, active: item.id === meta.id }));

    const context = { ...data, page, nav, year: new Date().getFullYear() };
    const html = render(body, [context], partials);
    fs.writeFileSync(path.join(DIR.dist, file), html);
    pages.push({ file, html });
  }
  return pages;
}

function buildCss() {
  fs.mkdirSync(path.join(DIR.dist, 'css'), { recursive: true });
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['sass', '--no-source-map', '--style=compressed', '--load-path', DIR.scss,
      path.join(DIR.scss, 'main.scss'), path.join(DIR.dist, 'css', 'main.css')],
    { stdio: 'inherit' }
  );
}

function buildSitemap(pages, site) {
  const base = site.brand.url.replace(/\/$/, '');
  const urls = pages
    .map((p) => {
      const loc = p.file === 'index.html' ? `${base}/` : `${base}/${p.file}`;
      const priority = p.file === 'index.html' ? '1.0' : '0.7';
      return `  <url><loc>${loc}</loc><priority>${priority}</priority></url>`;
    })
    .join('\n');
  fs.writeFileSync(
    path.join(DIR.dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
  fs.writeFileSync(
    path.join(DIR.dist, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
  );
}

function build() {
  const started = Date.now();
  fs.rmSync(DIR.dist, { recursive: true, force: true });
  fs.mkdirSync(DIR.dist, { recursive: true });

  const data = derive(loadData());
  const partials = loadPartials();
  const pages = buildHtml(data, partials);

  buildCss();
  copyDir(DIR.js, path.join(DIR.dist, 'js'));
  copyDir(path.join(DIR.assets, 'img'), path.join(DIR.dist, 'img'));
  copyDir(path.join(DIR.assets, 'fonts'), path.join(DIR.dist, 'fonts'));
  // the JSON is shipped too, so a CMS or a simple fetch can read the same source
  copyDir(DIR.data, path.join(DIR.dist, 'data'));

  buildSitemap(pages, data.site);
  console.log(`built ${pages.length} pages in ${Date.now() - started}ms -> dist/`);
}

if (process.argv.includes('--watch')) {
  build();
  const watched = [DIR.data, DIR.pages, DIR.partials, DIR.scss, DIR.js];
  let timer = null;
  for (const dir of watched) {
    fs.watch(dir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { build(); } catch (err) { console.error(err.message); }
      }, 120);
    });
  }
  console.log('watching for changes…');
} else {
  build();
}

module.exports = { render, walk };
