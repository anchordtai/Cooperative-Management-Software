import nodemailer from 'nodemailer';
import { brand } from '../config/brand';

const smtpErrorCodes = new Set([
  'EAUTH', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EDNS', 'EENVELOPE', 'EMESSAGE', 'ESOCKET', 'ETIMEDOUT', 'ETLS'
]);

function smtpConfiguration() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const port = Number(SMTP_PORT || 587);
  if (!SMTP_HOST?.trim() || !SMTP_FROM?.trim() || !SMTP_USER?.trim() || !SMTP_PASS?.trim() ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return { host: SMTP_HOST.trim(), port, user: SMTP_USER.trim(), pass: SMTP_PASS, from: SMTP_FROM.trim() };
}

export const isEmailConfigured = () => smtpConfiguration() !== null;

export const sendEmail = async (to: string, subject: string, text: string) => {
  const config = smtpConfiguration();
  if (!config) throw new Error('SMTP delivery is not configured');
  const { host, port, user, pass, from } = config;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    socketTimeout: 10000
  });

  const footer = [brand.name, brand.tagline, brand.attribution].join('\n');
  try {
    return await transporter.sendMail({ from, to, subject, text: `${text}\n\n${footer}` });
  } catch (error) {
    const failure = error as { code?: unknown; responseCode?: unknown } | undefined;
    const code = typeof failure?.code === 'string' && smtpErrorCodes.has(failure.code) ? failure.code : 'UNKNOWN';
    const status = failure?.responseCode;
    const responseCode = typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 600 ? status : undefined;
    console.error('Email delivery failed', { code, responseCode });
    throw error;
  }
};
