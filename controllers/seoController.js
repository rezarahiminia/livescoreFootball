const SoccerSyncState = require('../models/soccerSyncState');

function siteUrl() {
    return String(
        process.env.PUBLIC_SITE_URL
        || process.env.API_URL
        || `http://localhost:${process.env.PORT || 3050}`
    ).replace(/\/$/, '');
}

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = app => {
    app.get('/robots.txt', (req, res) => {
        const baseUrl = siteUrl();
        res.type('text/plain');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send([
            'User-agent: *',
            'Allow: /$',
            'Allow: /api-docs/',
            'Disallow: /get/',
            'Disallow: /health',
            'Disallow: /api/health',
            '',
            `Sitemap: ${baseUrl}/sitemap.xml`,
            ''
        ].join('\n'));
    });

    app.get('/sitemap.xml', async(req, res) => {
        const baseUrl = siteUrl();
        let lastModified = new Date().toISOString();

        try {
            const sync = await SoccerSyncState.findOne({ status: 'healthy' })
                .sort({ last_success_at: -1 })
                .select('last_success_at')
                .lean();
            if (sync?.last_success_at) {
                lastModified = new Date(sync.last_success_at).toISOString();
            }
        } catch (error) {
            console.warn('Unable to read sitemap freshness:', error.message);
        }

        const entries = [
            { path: '/', changefreq: 'daily', priority: '1.0' },
            { path: '/api-docs/', changefreq: 'weekly', priority: '0.9' }
        ];
        const urls = entries.map(entry => `  <url>
    <loc>${xmlEscape(`${baseUrl}${entry.path}`)}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');

        res.type('application/xml');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
    });
};
