export interface WaitlistConfirmationEmailProps {
  email: string;
  school: string;
}

function style(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");
}

export function WaitlistConfirmationEmail({
  email,
  school,
}: WaitlistConfirmationEmailProps): string {
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

  return `<html lang="en"><head></head><body style="${style(main)}"><div style="${style(container)}"><div style="${style(header)}"><h1 style="${style(headerTitle)}">Thanks for signing up!</h1></div><div style="${style(content)}"><p style="${style(paragraph)}">Thanks for signing up, we'll notify you when your university is ready.</p><p style="${style(paragraph)}">We're excited to bring Afterclass to <strong>${school}</strong>. You'll be among the first to know when we launch at your university.</p><p style="${style(paragraph)}">Afterclass is the one app for your university. See every club event, pop-up, and sports event—all in one place. Finally find what's happening on campus and make the most of your college experience.</p><p style="${style(footerText)}">We'll send you an email at <a href="mailto:${email}" style="${style(link)}">${email}</a> when Afterclass is ready at ${school}.</p><p style="${style(disclaimer)}">If you didn't sign up for the waitlist, you can safely ignore this email.</p></div></div></body></html>`;
}

export default WaitlistConfirmationEmail;
