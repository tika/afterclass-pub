import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { PostHogIdentify } from "@/components/posthog-identify";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Afterclass",
  description: "Connect with your campus community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${dmSans.variable} antialiased`}>
          <Providers>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              forcedTheme="light"
            >
              <PostHogIdentify />
              {children}
              <Analytics />
            </ThemeProvider>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
