/**
 * Inquiry mailer — sends contact-form submissions to the company mailbox
 * (marutetsu3@carrot.ocn.ne.jp) over OCN's SMTP relay.
 *
 * Credentials (set on Netlify via `netlify env:set`, or in .env locally):
 *   OCN_SMTP_USER   OCN ID used for SMTP-AUTH (e.g. abcd1234)
 *   OCN_SMTP_PASS   its password
 * Optional overrides:
 *   OCN_SMTP_HOST   (default smtp.ocn.ne.jp)
 *   INQUIRY_FROM    (default marutetsu3@carrot.ocn.ne.jp)
 *   INQUIRY_TO      (default marutetsu3@carrot.ocn.ne.jp)
 *
 * Local dev without credentials: the mail step is skipped (logged), so the
 * form UX can be developed offline. In cloud mode missing credentials fail
 * loudly — a lost inquiry must never look successful.
 */
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.OCN_SMTP_HOST || 'smtp.ocn.ne.jp';
const FROM = process.env.INQUIRY_FROM || 'marutetsu3@carrot.ocn.ne.jp';
const TO = process.env.INQUIRY_TO || 'marutetsu3@carrot.ocn.ne.jp';

function jstStamp() {
  return new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' JST');
}

function buildMail(f) {
  const line = '──────────────────────────────';
  const text = [
    'マルテツフーズ株式会社のウェブサイトより、新しいお問い合わせを受け付けました。',
    '',
    line,
    `お名前　　　　：${f.name}`,
    `会社名・店舗名：${f.company || '（未入力）'}`,
    `メール　　　　：${f.email}`,
    `電話番号　　　：${f.tel || '（未入力）'}`,
    `お問い合わせ種類：${f.category || 'その他'}`,
    line,
    '',
    '【お問い合わせ内容】',
    f.message,
    '',
    line,
    `送信日時：${jstStamp()}`,
    '※このメールは marutetsufoods.com のお問い合わせフォームから自動送信されました。',
    '※このメールに「返信」すると、お客様のご登録メールアドレス宛てに届きます。'
  ].join('\n');

  return {
    from: `MARUTETSU ウェブサイト <${FROM}>`,
    to: TO,
    replyTo: `${f.name.replace(/[<>"@]/g, '')} <${f.email}>`,
    subject: `【マルテツフーズ】${f.category || 'お問い合わせ'} — ${f.name} 様より`,
    text
  };
}

async function sendInquiryMail(fields) {
  const user = process.env.OCN_SMTP_USER;
  const pass = process.env.OCN_SMTP_PASS;
  if (!user || !pass) {
    if (process.env.NETLIFY) throw new Error('SMTP credentials are not configured');
    console.warn('[dev] OCN_SMTP_USER / OCN_SMTP_PASS 未設定 — メール送信をスキップします（ローカル模式）');
    return { skipped: true };
  }

  const mail = buildMail(fields);
  // OCN offers both STARTTLS on 587 and implicit TLS on 465 — try 587 first,
  // fall back to 465 so a blocked port never loses an inquiry.
  const configs = [
    { host: SMTP_HOST, port: 587, secure: false, requireTLS: true },
    { host: SMTP_HOST, port: 465, secure: true }
  ];
  let lastError = null;
  for (const cfg of configs) {
    const transport = nodemailer.createTransport({
      ...cfg,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 12000,
      socketTimeout: 20000
    });
    try {
      await transport.sendMail(mail);
      return { sent: true };
    } catch (e) {
      lastError = e;
    } finally {
      transport.close();
    }
  }
  throw lastError || new Error('SMTP send failed');
}

module.exports = { sendInquiryMail };
