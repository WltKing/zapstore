import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Zapstore",
  description: "Atendimento WhatsApp com IA para o seu negocio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={poppins.variable}>
      <body className="bg-neutral-50 font-sans text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
