import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const materialSymbols = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap";
const googleFonts = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Montserrat:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Cinzel:wght@400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: "LandingChat - El Futuro de las Compras es una Conversación",
  description: "Plataforma de comercio conversacional y gestión de agentes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link href={materialSymbols} rel="stylesheet" />
        <link href={googleFonts} rel="stylesheet" />
      </head>
      <body
        suppressHydrationWarning
        className={`${manrope.className} antialiased bg-background-light dark:bg-background-dark text-text-light-primary dark:text-text-dark-primary`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}

