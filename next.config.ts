import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Force API routes to run in Node.js runtime (not Edge) — needed for crypto module
  experimental: {},
}

export default nextConfig
