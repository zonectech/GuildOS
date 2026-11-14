/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep review builds apart from the dev server, like the current frontend.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
};

export default nextConfig;
