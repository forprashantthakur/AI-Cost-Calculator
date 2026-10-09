// Turns dist-single/index.html into a page body for publishing as a claude.ai
// Artifact: <title>, <style>, the app root and the inline module script,
// without the outer html/head/body skeleton (the host adds its own).
import fs from 'node:fs';

const src = fs.readFileSync('dist-single/index.html', 'utf8');
const title = src.match(/<title>[\s\S]*?<\/title>/)?.[0] ?? '<title>Enterprise AI Agent Pricing &amp; Value Calculator</title>';
const styles = [...src.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const script = src.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
if (!script) throw new Error('module script not found');
// Libraries carry literal U+FFFD characters inside string literals; write them
// as the equivalent \uFFFD escape so the published file has no raw U+FFFD.
const code = script[1].replace(/\uFFFD/g, '\\uFFFD');
const out = `${title}\n${styles}\n<div id="root"></div>\n<script type="module">${code}</script>\n`;
fs.writeFileSync('dist-single/artifact.html', out);
console.log(`dist-single/artifact.html ${(out.length / 1e6).toFixed(2)} MB`);
