/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@matchnarrator/shared'],
  images: {
    domains: ['upload.wikimedia.org'],
  },
};

module.exports = nextConfig;
