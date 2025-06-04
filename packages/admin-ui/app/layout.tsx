import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AdminLayout from "@/components/layout/AdminLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bot System Admin",
  description: "Admin UI for the Bot Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} antialiased`}>
        <AdminLayout>
          {children}
        </AdminLayout>
      </body>
    </html>
  );
}
