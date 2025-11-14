const nodemailer = require('nodemailer');

// Email configuration from environment variables
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Recipient emails
const RECIPIENT_EMAILS = [
  'shafinahnam89@gmail.com',
  'ashikpullock99@gmail.com',
];

const sendContactEmail = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    // Check if email credentials are configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD in .env file');
      return res.status(500).json({
        success: false,
        message: 'Email service is not configured. Please contact the administrator.',
      });
    }

    // Create transporter
    const transporter = createTransporter();

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: RECIPIENT_EMAILS.join(', '),
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="margin-top: 20px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-left: 4px solid #0f172a;">
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap; margin-top: 10px;">${message}</p>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            <p>This email was sent from the TransNova Careers contact form.</p>
            <p>You can reply directly to this email to respond to ${name} at ${email}.</p>
          </div>
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This email was sent from the TransNova Careers contact form.
You can reply directly to this email to respond to ${name} at ${email}.
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon!',
    });
  } catch (error) {
    console.error('Error sending contact email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  sendContactEmail,
};

