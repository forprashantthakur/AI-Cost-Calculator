/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the calculator runs entirely in the browser, so it can be
  // hosted on Vercel, Netlify, GitHub Pages, S3 or any static web server.
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
};
export default nextConfig;
