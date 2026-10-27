/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep local visual-review builds separate from the running development site.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
};

export default nextConfig;
