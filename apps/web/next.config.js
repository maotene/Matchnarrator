/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@matchnarrator/shared'],
  images: {
    domains: ['upload.wikimedia.org'],
  },
  webpack: (config) => {
    // Konva/react-konva require 'canvas' for Node.js SSR but it's browser-only
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

module.exports = nextConfig;
