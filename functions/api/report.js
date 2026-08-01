// Cloudflare Pages Function: device telemetry sink.
// Phone posts error/perf reports here; we forward them as GitHub issues on
// dashattackman/dagame so the build session can read them via the GitHub API
// (its container can't reach *.pages.dev, but CAN read GitHub).
//
// Setup (one-time, in Cloudflare Pages → Settings → Environment variables):
//   GH_REPORT_TOKEN = fine-grained GitHub PAT, repo dashattackman/dagame,
//                     permission: Issues (read/write). Nothing else.
// Until the token is set, reports are accepted and dropped (202).

export async function onRequestPost({ request, env }) {
  let report;
  try {
    const text = await request.text();
    if (text.length > 65536) return new Response('too large', { status: 413 });
    report = JSON.parse(text);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  const kind = report.kind === 'error' ? 'error' : 'perf';
  if (!env.GH_REPORT_TOKEN) {
    return new Response(JSON.stringify({ stored: false, reason: 'no token configured' }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    });
  }

  const firstErr = Array.isArray(report.errors) && report.errors[0]
    ? String(report.errors[0]).split('\n')[0].slice(0, 80)
    : '';
  const title =
    kind === 'error'
      ? `[device-report] error: ${firstErr || 'unknown'} (${report.transport ?? '?'})`
      : `[device-report] perf: ${report.stats?.fps ?? '?'}fps ${report.transport ?? '?'} (${report.build ?? '?'})`;

  const body =
    'Automated device report from the deployed PWA.\n\n```json\n' +
    JSON.stringify(report, null, 2).slice(0, 60000) +
    '\n```\n';

  const gh = await fetch('https://api.github.com/repos/dashattackman/dagame/issues', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.GH_REPORT_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'twin-cities-telemetry',
    },
    body: JSON.stringify({ title, body, labels: ['device-report', kind] }),
  });

  return new Response(JSON.stringify({ stored: gh.ok }), {
    status: gh.ok ? 201 : 502,
    headers: { 'content-type': 'application/json' },
  });
}
