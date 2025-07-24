import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    console.log('📧 Attempting to send email to:', to);
    console.log('📧 SMTP Config:', {
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM,
      hasPassword: !!process.env.SMTP_PASS
    });
    
    // Production-ready email configuration with Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || process.env.SMTP_FROM,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"E-Cooperative" <${process.env.SMTP_FROM}>`,
      to,
      subject,
      text,
      html: html || text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully to:', to);
    console.log('Message ID:', result.messageId);
    return result;
    
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    // In development, log email content if sending fails
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 EMAIL CONTENT (Fallback):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Text:', text);
      console.log('--- End Email ---');
    }
    throw error; // Re-throw for proper error handling
  }
};