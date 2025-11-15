const nodemailer = require('nodemailer');

// Reuse the same email configuration from contactController
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD in .env file');
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

class EmailService {
  /**
   * Send job application email
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Email send result
   */
  async sendJobApplication({
    to,
    subject,
    applicantName,
    applicantEmail,
    applicantAddress,
    applicantCity,
    applicantState,
    applicantZip,
    applicantPhone,
    jobTitle,
    companyName,
    companyAddress,
    companyCity,
    companyState,
    companyZip,
    coverLetter,
    cvText,
  }) {
    try {
      // Check if email is configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        throw new Error('Email service is not configured');
      }

      // Only include fields that exist
      const hasCoverLetter = coverLetter && coverLetter.trim().length > 0;
      const hasCV = cvText && cvText.trim().length > 0;
      const hasJobTitle = jobTitle && jobTitle.trim().length > 0;
      const hasCompanyName = companyName && companyName.trim().length > 0;
      const hasApplicantName = applicantName && applicantName.trim().length > 0;
      const hasApplicantEmail = applicantEmail && applicantEmail.trim().length > 0;
      
      // Build applicant address (only if all parts exist)
      const applicantAddressParts = [];
      if (applicantAddress && applicantAddress.trim()) applicantAddressParts.push(applicantAddress.trim());
      if (applicantCity && applicantCity.trim()) applicantAddressParts.push(applicantCity.trim());
      if (applicantState && applicantState.trim()) applicantAddressParts.push(applicantState.trim());
      if (applicantZip && applicantZip.trim()) applicantAddressParts.push(applicantZip.trim());
      const hasApplicantAddress = applicantAddressParts.length > 0;
      const hasApplicantPhone = applicantPhone && applicantPhone.trim().length > 0;
      
      // Build company address (only if all parts exist)
      const companyAddressParts = [];
      if (companyAddress && companyAddress.trim()) companyAddressParts.push(companyAddress.trim());
      if (companyCity && companyCity.trim()) companyAddressParts.push(companyCity.trim());
      if (companyState && companyState.trim()) companyAddressParts.push(companyState.trim());
      if (companyZip && companyZip.trim()) companyAddressParts.push(companyZip.trim());
      const hasCompanyAddress = companyAddressParts.length > 0;

      // Build subject line (only include existing fields)
      let emailSubject = subject;
      if (!emailSubject) {
        const subjectParts = [];
        if (hasJobTitle && hasCompanyName) {
          emailSubject = `Job Application: ${jobTitle} at ${companyName}`;
        } else if (hasJobTitle) {
          emailSubject = `Job Application: ${jobTitle}`;
        } else if (hasCompanyName) {
          emailSubject = `Job Application at ${companyName}`;
        } else {
          emailSubject = 'Job Application';
        }
      }

      const transporter = createTransporter();

      // Build HTML content (only include sections with data)
      const htmlParts = [];
      htmlParts.push('<!DOCTYPE html><html><head><meta charset="utf-8"><style>');
      htmlParts.push('body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }');
      htmlParts.push('.container { max-width: 600px; margin: 0 auto; padding: 20px; }');
      htmlParts.push('.header { background-color: #0f172a; color: white; padding: 20px; text-align: center; }');
      htmlParts.push('.content { background-color: #f8f9fa; padding: 20px; }');
      htmlParts.push('.footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }');
      htmlParts.push('.cv-section { background-color: white; padding: 15px; margin-top: 20px; border-left: 4px solid #0f172a; }');
      htmlParts.push('pre { white-space: pre-wrap; font-family: "Courier New", monospace; font-size: 11px; }');
      htmlParts.push('</style></head><body><div class="container">');
      htmlParts.push('<div class="header"><h2>Job Application</h2></div>');
      htmlParts.push('<div class="content">');
      htmlParts.push('<p>Dear Hiring Manager,</p>');
      
      if (hasCoverLetter) {
        htmlParts.push(`<div style="margin: 20px 0;">${coverLetter.replace(/\n/g, '<br>')}</div>`);
      }
      
      if (hasApplicantName || hasApplicantEmail || hasApplicantAddress || hasApplicantPhone) {
        htmlParts.push('<p>Best regards,');
        if (hasApplicantName) htmlParts.push(`<br>${applicantName}`);
        if (hasApplicantAddress) htmlParts.push(`<br>${applicantAddressParts.join(', ')}`);
        if (hasApplicantPhone) htmlParts.push(`<br>Phone: ${applicantPhone}`);
        if (hasApplicantEmail) htmlParts.push(`<br>${applicantEmail}`);
        htmlParts.push('</p>');
      }
      
      // Add company address if available
      if (hasCompanyAddress) {
        htmlParts.push('<div style="margin-top: 20px; padding: 10px; background-color: #e9ecef; border-left: 3px solid #0f172a;">');
        htmlParts.push('<strong>Company Address:</strong><br>');
        if (hasCompanyName) htmlParts.push(`${companyName}<br>`);
        htmlParts.push(`${companyAddressParts.join(', ')}`);
        htmlParts.push('</div>');
      }
      
      if (hasCV) {
        htmlParts.push('<div class="cv-section">');
        htmlParts.push('<h3 style="margin-top: 0;">Curriculum Vitae</h3>');
        htmlParts.push(`<pre>${cvText}</pre>`);
        htmlParts.push('</div>');
      }
      
      htmlParts.push('</div>');
      htmlParts.push('<div class="footer"><p>This application was submitted through TransNova Career Platform</p></div>');
      htmlParts.push('</div></body></html>');

      // Build text content (only include sections with data)
      const textParts = [];
      if (hasJobTitle && hasCompanyName) {
        textParts.push(`Job Application: ${jobTitle} at ${companyName}`);
      } else if (hasJobTitle) {
        textParts.push(`Job Application: ${jobTitle}`);
      } else if (hasCompanyName) {
        textParts.push(`Job Application at ${companyName}`);
      } else {
        textParts.push('Job Application');
      }
      textParts.push('\n\nDear Hiring Manager,\n');
      
      if (hasCoverLetter) {
        textParts.push(coverLetter);
        textParts.push('\n');
      }
      
      if (hasApplicantName || hasApplicantEmail || hasApplicantAddress || hasApplicantPhone) {
        textParts.push('\nBest regards,');
        if (hasApplicantName) textParts.push(`\n${applicantName}`);
        if (hasApplicantAddress) textParts.push(`\n${applicantAddressParts.join(', ')}`);
        if (hasApplicantPhone) textParts.push(`\nPhone: ${applicantPhone}`);
        if (hasApplicantEmail) textParts.push(`\n${applicantEmail}`);
      }
      
      // Add company address if available
      if (hasCompanyAddress) {
        textParts.push('\n\n---\nCOMPANY ADDRESS\n---\n');
        if (hasCompanyName) textParts.push(`${companyName}\n`);
        textParts.push(`${companyAddressParts.join(', ')}\n`);
      }
      
      if (hasCV) {
        textParts.push('\n\n---\nCURRICULUM VITAE\n---\n\n');
        textParts.push(cvText);
      }

      const mailOptions = {
        from: hasApplicantName 
          ? `"${applicantName}" <${process.env.EMAIL_USER}>`
          : process.env.EMAIL_USER,
        replyTo: hasApplicantEmail ? applicantEmail : undefined,
        to: to,
        subject: emailSubject,
        html: htmlParts.join(''),
        text: textParts.join(''),
      };

      const info = await transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        message: 'Application email sent successfully',
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send application email: ${error.message}`);
    }
  }

  /**
   * Send skill recommendation email to user
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Email send result
   */
  async sendSkillRecommendations({
    to,
    userName,
    recommendedSkills,
    analysis,
    reasoning,
  }) {
    try {
      // Check if email is configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        throw new Error('Email service is not configured');
      }

      const transporter = createTransporter();

      const subject = '🎯 Personalized Skill Recommendations for Your Career Growth';

      // Build HTML content
      const htmlParts = [];
      htmlParts.push('<!DOCTYPE html><html><head><meta charset="utf-8"><style>');
      htmlParts.push('body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }');
      htmlParts.push('.container { max-width: 600px; margin: 0 auto; padding: 20px; }');
      htmlParts.push('.header { background-color: #0f172a; color: white; padding: 20px; text-align: center; }');
      htmlParts.push('.content { background-color: #f8f9fa; padding: 20px; }');
      htmlParts.push('.skill-item { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid #0f172a; }');
      htmlParts.push('.footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }');
      htmlParts.push('</style></head><body><div class="container">');
      htmlParts.push('<div class="header"><h2>🎯 Skill Recommendations</h2></div>');
      htmlParts.push('<div class="content">');
      htmlParts.push(`<p>Dear ${userName || 'User'},</p>`);
      htmlParts.push('<p>Based on our analysis of your profile and the current job market in your domain, we have identified essential skills that will help you stay competitive and advance your career.</p>');
      
      if (recommendedSkills && recommendedSkills.length > 0) {
        htmlParts.push('<h3>Recommended Skills to Develop:</h3>');
        recommendedSkills.forEach((skill, index) => {
          htmlParts.push(`<div class="skill-item"><strong>${index + 1}. ${skill}</strong></div>`);
        });
      }

      if (analysis) {
        htmlParts.push('<h3>Why These Skills Matter:</h3>');
        const analysisText = typeof analysis === 'string' ? analysis : String(analysis || '');
        htmlParts.push(`<p>${analysisText.replace(/\n/g, '<br>')}</p>`);
      }

      if (reasoning) {
        htmlParts.push('<h3>Detailed Analysis:</h3>');
        const reasoningText = typeof reasoning === 'string' ? reasoning : String(reasoning || '');
        htmlParts.push(`<p>${reasoningText.replace(/\n/g, '<br>')}</p>`);
      }

      htmlParts.push('<p style="margin-top: 20px;">We recommend focusing on these skills to enhance your career prospects. You can add these skills to your profile and explore learning resources in our platform.</p>');
      htmlParts.push('<p>Best regards,<br>TransNova Career Platform</p>');
      htmlParts.push('</div>');
      htmlParts.push('<div class="footer"><p>This is an automated recommendation based on current job market analysis.</p></div>');
      htmlParts.push('</div></body></html>');

      // Build text content
      const textParts = [];
      textParts.push('Skill Recommendations for Your Career Growth\n');
      textParts.push(`Dear ${userName || 'User'},\n`);
      textParts.push('Based on our analysis of your profile and the current job market in your domain, we have identified essential skills that will help you stay competitive and advance your career.\n');
      
      if (recommendedSkills && recommendedSkills.length > 0) {
        textParts.push('Recommended Skills to Develop:\n');
        recommendedSkills.forEach((skill, index) => {
          textParts.push(`${index + 1}. ${skill}\n`);
        });
        textParts.push('\n');
      }

      if (analysis) {
        textParts.push('Why These Skills Matter:\n');
        const analysisText = typeof analysis === 'string' ? analysis : String(analysis || '');
        textParts.push(`${analysisText}\n\n`);
      }

      if (reasoning) {
        textParts.push('Detailed Analysis:\n');
        const reasoningText = typeof reasoning === 'string' ? reasoning : String(reasoning || '');
        textParts.push(`${reasoningText}\n\n`);
      }

      textParts.push('We recommend focusing on these skills to enhance your career prospects. You can add these skills to your profile and explore learning resources in our platform.\n');
      textParts.push('\nBest regards,\nTransNova Career Platform');

      const mailOptions = {
        from: `"TransNova Career Platform" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: htmlParts.join(''),
        text: textParts.join(''),
      };

      const info = await transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        message: 'Skill recommendation email sent successfully',
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send skill recommendation email: ${error.message}`);
    }
  }
}

module.exports = new EmailService();

