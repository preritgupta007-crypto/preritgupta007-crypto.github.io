// Contact form backend (Cloudflare Pages Function) for https://athlomate.app/contact.
// POST /api/contact with JSON {name, email, message, website, t}. Sends one email through Resend.
// Secrets (Cloudflare Pages > Settings > Variables and Secrets, never in the repo):
//   RESEND_API_KEY    required. A Resend API key with "Sending access".
//   CONTACT_TO_EMAIL  required. The inbox that receives the messages.
//   CONTACT_FROM      optional. Default: Athlomate Contact <alerts@athlomate.app> (the domain is verified in Resend).
// Nothing is stored: the message is only forwarded. Message text is never written to logs.

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

const ALLOWED_ORIGINS = ['https://athlomate.app', 'https://www.athlomate.app'];
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function originAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Preview deployments of this project (for testing before merging).
  return /^https:\/\/([a-z0-9-]+\.)?athlomate\.pages\.dev$/.test(origin);
}

const oneLine = (s) => String(s).replace(/[\r\n\t]+/g, ' ').trim();

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request.headers.get('Origin'))) return reply(403, { ok: false, error: 'origin' });
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) {
    return reply(415, { ok: false, error: 'type' });
  }

  let data;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return reply(413, { ok: false, error: 'size' });
    data = JSON.parse(raw);
  } catch (e) {
    return reply(400, { ok: false, error: 'json' });
  }
  if (!data || typeof data !== 'object') return reply(400, { ok: false, error: 'json' });

  // Spam traps: a hidden field only bots fill in, and a form that was "submitted" within 3 seconds of loading.
  // Pretend success so bots learn nothing.
  const openedMs = Number(data.t);
  if (data.website || !(openedMs >= 3000)) return reply(200, { ok: true });

  const name = oneLine(data.name || '');
  const email = oneLine(data.email || '');
  const message = String(data.message || '').replace(/\r\n/g, '\n').trim();
  if (name.length < 1 || name.length > 100) return reply(400, { ok: false, error: 'name' });
  if (email.length > 200 || !EMAIL_RE.test(email)) return reply(400, { ok: false, error: 'email' });
  if (message.length < 10 || message.length > 3000) return reply(400, { ok: false, error: 'message' });

  if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL) return reply(500, { ok: false, error: 'config' });

  const text = `From: ${name} <${email}>\n\n${message}\n\n--\nSent through the contact form at athlomate.app/contact. Reply to this email to answer.`;
  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.CONTACT_FROM || 'Athlomate Contact <alerts@athlomate.app>',
        to: [env.CONTACT_TO_EMAIL],
        reply_to: email,
        subject: `Athlomate contact form: ${name}`.slice(0, 150),
        text,
      }),
    });
  } catch (e) {
    return reply(502, { ok: false, error: 'send' });
  }
  if (!res.ok) return reply(502, { ok: false, error: 'send' });
  return reply(200, { ok: true });
}

// Anything but POST is not allowed.
export async function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
