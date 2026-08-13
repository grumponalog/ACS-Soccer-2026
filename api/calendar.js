// Same-origin proxy for the team's sportsYou calendar feed.
// sportsYou serves the .ics without CORS headers, so the browser can't read it
// directly. This function fetches it server-side and re-serves it from our own
// domain, cached at the edge for 5 minutes.
//
// CommonJS on purpose: this repo has no package.json, so Vercel treats plain
// .js files as CommonJS.

const FEED_URL =
  'https://calendar.sportsyou.com/access/us-be701e54-f8ae-4076-9f6d-b810fa55c8e2/3984e064-3776-4039-8d8a-cb31cefcc695';

module.exports = async function handler(req, res) {
  try {
    const upstream = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'acs-soccer-2026-site' }
    });

    if (!upstream.ok) {
      res.status(502).send('Calendar feed unavailable');
      return;
    }

    const body = await upstream.text();

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).send(body);
  } catch (err) {
    res.status(502).send('Calendar feed unavailable');
  }
};
