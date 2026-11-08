import "./globals.css";

export const metadata = {
  title: "Quiz Portal",
  description: "Timed online quiz",
};

// Makes the site scale correctly on phones.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
