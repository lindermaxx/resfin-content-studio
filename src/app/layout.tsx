import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResFin Content Studio",
  description: "Sistema de criação de conteúdo para @residenciaemfinancas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} antialiased`}>
        <div className="flex h-screen bg-zinc-50">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
