/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@satbank/ui", "@satbank/shared-types", "@satbank/utils"],
}

module.exports = nextConfig