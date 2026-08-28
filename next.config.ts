import type { NextConfig } from 'next';

const isStaticExport = process.env.BUILD_STATIC_EXPORT === 'true';

const nextConfig: NextConfig = isStaticExport
  ? {
      output: 'export',
      basePath: process.env.NEXT_PUBLIC_BASE_PATH,
      assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH,
    }
  : {};

export default nextConfig;
