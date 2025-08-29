/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@satbank/ui', '@satbank/shared-types', '@satbank/utils'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
