import "./globals.css";
import type { Metadata } from "next";
import { ReloadButton } from "./components/ReloadButton";

export const metadata: Metadata = {
  title: "Payments Boilerplate",
  description: "Supabase + Polar + Next.js boilerplate for subscriptions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=sentient@300,400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen flex flex-col">
        <header className="border-b bg-white p-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <h1 className="text-lg font-semibold">Payments Boilerplate</h1>
            <ReloadButton />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t bg-white p-4 text-center text-sm text-gray-500">
          Built with Next.js, Supabase & Polar
        </footer>
      </body>
    </html>
  );
}
