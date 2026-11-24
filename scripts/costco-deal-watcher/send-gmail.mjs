// Minimal SMTPS client for Gmail app passwords. No npm deps.

import tls from 'node:tls';

function b64(s) {
  return Buffer.from(s, 'utf8').toString('base64');
}

function encodeSubject(subject) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${b64(subject)}?=`;
}

export function sendGmail({ user, pass, to, subject, body }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!user || !pass || !recipients.length) {
    throw new Error('Gmail user, app password, and at least one recipient are required');
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com', timeout: 30000 },
      () => {}
    );

    let buf = '';
    const queue = [];
    let step = 0;
    let finished = false;

    const fail = (err) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const commands = [
      'EHLO localhost\r\n',
      'AUTH LOGIN\r\n',
      `${b64(user)}\r\n`,
      `${b64(pass)}\r\n`,
      `MAIL FROM:<${user}>\r\n`,
      ...recipients.map((r) => `RCPT TO:<${r}>\r\n`),
      'DATA\r\n',
    ];

    const payload =
      `From: ${user}\r\n` +
      `To: ${recipients.join(', ')}\r\n` +
      `Subject: ${encodeSubject(subject)}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset=UTF-8\r\n` +
      `\r\n` +
      body.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..') +
      `\r\n.\r\n`;

    const maybeSend = (code) => {
      if (step === 0) {
        if (code !== 220) return fail(new Error(`SMTP greeting ${code}: ${buf.slice(0, 200)}`));
        socket.write(commands[0]);
        step = 1;
        return;
      }
      if (step < commands.length) {
        if (code >= 400) return fail(new Error(`SMTP ${code} at step ${step}: ${buf.slice(0, 300)}`));
        socket.write(commands[step]);
        step += 1;
        return;
      }
      if (step === commands.length) {
        if (code !== 354) return fail(new Error(`SMTP DATA not accepted (${code})`));
        socket.write(payload);
        step += 1;
        return;
      }
      if (step === commands.length + 1) {
        if (code >= 400) return fail(new Error(`SMTP send failed ${code}: ${buf.slice(0, 300)}`));
        socket.write('QUIT\r\n');
        step += 1;
        finished = true;
        socket.end();
        resolve();
      }
    };

    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const parts = buf.split(/\r?\n/);
      buf = parts.pop() || '';
      for (const line of parts) {
        queue.push(line);
        if (/^\d{3}[\s-]/.test(line) && line.charAt(3) !== '-') {
          const code = Number(line.slice(0, 3));
          maybeSend(code);
        }
      }
    });
    socket.on('error', fail);
    socket.on('timeout', () => fail(new Error('SMTP timeout')));
    socket.on('end', () => {
      if (!finished) fail(new Error('SMTP connection closed early'));
    });
  });
}
