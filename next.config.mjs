/** @type {import('next').NextConfig} */
const nextConfig = {
  // These two libraries read PDF/DOCX files. They must run as normal Node.js
  // packages on the server instead of being bundled by Next.js.
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
