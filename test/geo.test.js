const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');

test('HTML template advertises AI discovery resources and includes Umami analytics', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'public', 'index.html'), 'utf8');

    assert.match(html, /rel="alternate" type="text\/plain" href="\/llms\.txt"/);
    assert.match(html, /rel="alternate" type="text\/plain" href="\/llms-full\.txt"/);
    assert.match(html, /rel="service-desc"[^>]+href="\/openapi\.json"/);
    assert.match(html, /rel="describedby"[^>]+href="\/service-info\.json"/);
    assert.match(html, /href="\/ai-data-guide\.md"/);
    assert.match(html, /src="https:\/\/cloud\.umami\.is\/script\.js" data-website-id="50adaf15-8e00-45a5-aab5-6df10dd0ed5c"/);
});

test('AI data guide defines truthful freshness and citation rules', () => {
    const guide = fs.readFileSync(path.join(projectRoot, 'AI-DATA-GUIDE.md'), 'utf8');

    assert.match(guide, /stored snapshot/i);
    assert.match(guide, /Do not infer or invent/i);
    assert.match(guide, /lastSyncedAt/);
    assert.match(guide, /cite the most specific canonical/i);
    assert.match(guide, /does not grant or\s+assert ownership/i);
});

test('OpenAPI points assistants to the public data guide without claiming a data license', () => {
    const { specs } = require('../swagger');

    assert.equal(specs.openapi, '3.0.0');
    assert.match(specs.externalDocs.url, /\/ai-data-guide\.md$/);
    assert.match(specs.info.description, /stored snapshots/i);
    assert.equal(specs.info.license, undefined);
});
