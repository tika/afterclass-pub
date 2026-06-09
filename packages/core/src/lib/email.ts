import { Resend } from "resend";
import { GroupInvitationEmail } from "./emails/group-invitation";
import { WaitlistConfirmationEmail } from "./emails/waitlist-confirmation";
import { getSecrets } from "./secrets";

let resend: Resend | null = null;

async function getResend() {
  if (!resend) {
    const { resendApiKey } = await getSecrets();
    resend = new Resend(resendApiKey);
  }
  return resend;
}

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@afterclass.rsvp";
const WEB_URL = process.env.WEB_URL || "http://localhost:3000";

export interface GroupInvitationEmailParams {
  email: string;
  groupName: string;
  inviterName?: string;
}

export async function sendGroupInvitationEmail({
  email,
  groupName,
  inviterName,
}: GroupInvitationEmailParams) {
  const signUpUrl = WEB_URL;

  const html = GroupInvitationEmail({
    email,
    groupName,
    inviterName,
    signUpUrl,
  });

  // Generate plain text version
  const text = `
You've been invited to join ${groupName} on Afterclass!

${inviterName ? `${inviterName} has` : "You've"} invited you to join ${groupName} on Afterclass.

Afterclass is the one app for your university. Join to see every club event, pop-up, and sports event—all in one place.

Get started: ${signUpUrl}

Download the Afterclass app and sign up with your email (${email}) to join ${groupName}. Once you complete your profile, you'll automatically be added to the group.

If you didn't expect this invitation, you can safely ignore this email.
	`.trim();

  const resend = await getResend();
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `You've been invited to join ${groupName} on Afterclass`,
    html,
    text,
  });

  return result;
}

export interface WaitlistConfirmationEmailParams {
  email: string;
  school: string;
}

export async function sendWaitlistConfirmationEmail({
  email,
  school,
}: WaitlistConfirmationEmailParams) {
  const html = WaitlistConfirmationEmail({
    email,
    school,
  });

  // Generate plain text version
  const text = `
Thanks for signing up for the Afterclass waitlist!

Thanks for signing up, we'll notify you when your university is ready.

We're excited to bring Afterclass to ${school}. You'll be among the first to know when we launch at your university.

Afterclass is the one app for your university. See every club event, pop-up, and sports event—all in one place. Finally find what's happening on campus and make the most of your college experience.

We'll send you an email at ${email} when Afterclass is ready at ${school}.

If you didn't sign up for the waitlist, you can safely ignore this email.
	`.trim();

  const resend = await getResend();
  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Thanks for joining the Afterclass waitlist!",
    html,
    text,
  });

  console.log("Email sent:", result);

  return result;
}
