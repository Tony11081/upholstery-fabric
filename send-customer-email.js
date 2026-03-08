const { sendEmail } = require('./lib/email.ts');

const emailContent = {
  to: 'annacovington1@gmail.com',
  subject: 'Payment Received - Your Order UOOTD-RQ-2026-02-38777',
  text: `Hi,

Thank you for your payment! We've received it and your order is confirmed.

I completely understand your concern about the hinge issue from your last order. I want to assure you that we've noted your specific requirement - this piece will be made WITHOUT a hinge, exactly like the authentic version.

We're working with our supplier to ensure every detail matches the genuine Cartier bracelet, including:
- No hinge mechanism (as per authentic design)
- Correct clasp function
- Proper finishing and proportions

Preparation time: 3 days
We'll send you QC photos before shipping so you can verify everything looks correct.

If you have any other specific details you'd like us to check, please let me know now while we're preparing your order.

Best regards,
UOOTD Team`,
  html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;">
<p>Hi,</p>

<p>Thank you for your payment! We've received it and your order is confirmed.</p>

<p>I completely understand your concern about the hinge issue from your last order. I want to assure you that we've noted your specific requirement - this piece will be made <strong>WITHOUT a hinge</strong>, exactly like the authentic version.</p>

<p>We're working with our supplier to ensure every detail matches the genuine Cartier bracelet, including:</p>
<ul>
<li>No hinge mechanism (as per authentic design)</li>
<li>Correct clasp function</li>
<li>Proper finishing and proportions</li>
</ul>

<p><strong>Preparation time: 3 days</strong><br>
We'll send you QC photos before shipping so you can verify everything looks correct.</p>

<p>If you have any other specific details you'd like us to check, please let me know now while we're preparing your order.</p>

<p>Best regards,<br>
UOOTD Team</p>
</div>`
};

async function main() {
  try {
    console.log('Sending email to:', emailContent.to);
    console.log('Subject:', emailContent.subject);
    
    await sendEmail(emailContent);
    
    console.log('✅ Email sent successfully!');
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  }
}

main();
