import nodemailer from 'nodemailer';
import { brand } from '../config/brand';

function smtpConfiguration() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_FROM || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return { host: SMTP_HOST, port: Number(SMTP_PORT || 587), user: SMTP_USER, pass: SMTP_PASS, from: SMTP_FROM };
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
  return transporter.sendMail({ from, to, subject, text: `${text}\n\n${footer}` });
};
