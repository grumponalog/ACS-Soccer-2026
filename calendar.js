/* ACS Lions Soccer — sportsYou calendar loader.
   Pulls the team's live sportsYou feed through /api/calendar (a same-origin
   proxy, since sportsYou doesn't send CORS headers) and hands pages a clean,
   sorted event list. Every page keeps its built-in schedule as a fallback, so
   if the feed is unreachable nothing on the site breaks. */
window.ACSCal = (function () {
  var FEED = '/api/calendar';

  var DATE_ET = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  var TIME_ET = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit'
  });

  var COLORS = { game: '#FB8500', practice: '#2EC0F9', conditioning: '#2EC0F9',
                 meeting: '#F4B740', closure: '#9fb0bd', event: '#2EC0F9' };
  var LABELS = { game: 'Game', practice: 'Practice', conditioning: 'Conditioning',
                 meeting: 'Meeting', closure: 'Closed', event: 'Event' };

  function unfold(text) {
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
  }

  function unesc(v) {
    return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',')
            .replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
  }

  function parseDT(raw) {
    var m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!m) return null;
    if (!m[4]) return { date: m[1] + '-' + m[2] + '-' + m[3], time: null, allDay: true };
    var d = m[7]
      ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
      : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return { date: DATE_ET.format(d), time: TIME_ET.format(d), allDay: false };
  }

  function classify(summary) {
    var t = (summary || '').toLowerCase();
    if (/no practice|no school|cancell?ed|closed/.test(t)) return 'closure';
    if (/^vs\b|^at\b|scrimmage|tournament|jamboree/.test(t)) return 'game';
    if (/conditioning/.test(t)) return 'conditioning';
    if (/practice/.test(t)) return 'practice';
    if (/meeting|night|banquet|picture|photo/.test(t)) return 'meeting';
    return 'event';
  }

  function parse(text) {
    var lines = unfold(text).split('\n');
    var events = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('BEGIN:VEVENT') === 0) { cur = {}; continue; }
      if (line.indexOf('END:VEVENT') === 0) {
        if (cur && cur.start) {
          events.push({
            date: cur.start.date,
            time: cur.start.allDay ? null : cur.start.time,
            endTime: (cur.end && !cur.end.allDay) ? cur.end.time : null,
            allDay: cur.start.allDay,
            title: cur.summary || 'Event',
            location: cur.location || '',
            desc: cur.desc || '',
            type: classify(cur.summary)
          });
        }
        cur = null; continue;
      }
      if (!cur) continue;
      var c = line.indexOf(':');
      if (c < 0) continue;
      var key = line.slice(0, c).split(';')[0].toUpperCase();
      var val = line.slice(c + 1);
      if (key === 'DTSTART') cur.start = parseDT(val);
      else if (key === 'DTEND') cur.end = parseDT(val);
      else if (key === 'SUMMARY') cur.summary = unesc(val);
      else if (key === 'LOCATION') cur.location = unesc(val);
      else if (key === 'DESCRIPTION') cur.desc = unesc(val);
    }
    events.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return 0;
    });
    return events;
  }

  function load(cb) {
    if (!window.fetch) { cb(null); return; }
    var done = false;
    var finish = function (v) { if (!done) { done = true; cb(v); } };
    setTimeout(function () { finish(null); }, 6000);
    fetch(FEED, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) {
        if (t.indexOf('BEGIN:VCALENDAR') < 0) throw new Error('not ics');
        var evs = parse(t);
        finish(evs.length ? evs : null);
      })
      .catch(function () { finish(null); });
  }

  function todayET() { return DATE_ET.format(new Date()); }

  return { load: load, parse: parse, todayET: todayET, COLORS: COLORS, LABELS: LABELS };
})();
