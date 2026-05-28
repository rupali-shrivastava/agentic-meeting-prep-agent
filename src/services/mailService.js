import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendMeetingSummary({
  to,
  subject,
  html
}) {
  const msg = {
    to,
    from: process.env.SENDGRID_FROM,
    subject,
    html
  };

  const response = await sgMail.send(msg);

  return response;
}