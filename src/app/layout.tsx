import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "AI Research Intelligence System",
  description: "Capture, brief, and explore AI research",
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/ingest", label: "Ingest URL" },
  { href: "/rss", label: "RSS Feeds" },
  { href: "/library", label: "Library" },
  { href: "/ask", label: "Ask Research" },
  { href: "/graph", label: "Knowledge Graph" },
  { href: "/slack", label: "Slack" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen flex bg-slate-900 text-slate-100">
        <aside className="w-52 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col">
          <div className="px-4 py-5 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
              AI Research
            </span>
          </div>
          <nav className="flex-1 py-4">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
            MVP v1.0
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </body>
    </html>
  );
}
