export interface GroupInvitationEmailProps {
  email: string;
  groupName: string;
  inviterName?: string;
  signUpUrl: string;
}

function style(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");
}

export function GroupInvitationEmail({
  email,
  groupName,
  inviterName,
  signUpUrl,
}: GroupInvitationEmailProps): string {
  const main = {
    fontFamily:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    backgroundColor: "#f6f9fc",
    margin: "0",
    padding: "0",
  };

  const container = {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "0",
    maxWidth: "600px",
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  };

  const header = {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    padding: "30px",
    textAlign: "center",
  };

  const headerTitle = {
    color: "#ffffff",
    margin: "0",
    fontSize: "28px",
    fontWeight: "600",
  };

  const content = { padding: "30px" };

  const paragraph = {
    fontSize: "16px",
    lineHeight: "1.6",
    color: "#333333",
    margin: "0 0 20px 0",
  };

  const buttonContainer = { textAlign: "center", margin: "30px 0" };

  const button = {
    backgroundColor: "#667eea",
    borderRadius: "6px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center",
    display: "inline-block",
    padding: "14px 28px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  };

  const footerText = {
    fontSize: "14px",
    color: "#666666",
    paddingTop: "20px",
    borderTop: "1px solid #eeeeee",
    lineHeight: "1.6",
    margin: "30px 0 0 0",
  };

  const link = { color: "#667eea", textDecoration: "underline" };

  const disclaimer = {
    fontSize: "12px",
    color: "#999999",
    margin: "20px 0 0 0",
  };

  const inviteText = inviterName
    ? `Hi there! <strong>${inviterName}</strong> has invited you to join <strong>${groupName}</strong> on Afterclass.`
    : `You've been invited to join <strong>${groupName}</strong> on Afterclass.`;

  return `<html lang="en"><head></head><body style="${style(main)}"><div style="${style(container)}"><div style="${style(header)}"><h1 style="${style(headerTitle)}">You're Invited!</h1></div><div style="${style(content)}"><p style="${style(paragraph)}">${inviteText}</p><p style="${style(paragraph)}">Afterclass is the one app for your university. Join to see every club event, pop-up, and sports event—all in one place.</p><div style="${style(buttonContainer)}"><a href="${signUpUrl}" style="${style(button)}">Get Started</a></div><p style="${style(footerText)}">Download the Afterclass app and sign up with your email (<a href="mailto:${email}" style="${style(link)}">${email}</a>) to join ${groupName}. Once you complete your profile, you'll automatically be added to the group.</p><p style="${style(disclaimer)}">If you didn't expect this invitation, you can safely ignore this email.</p></div></div></body></html>`;
}

export default GroupInvitationEmail;
