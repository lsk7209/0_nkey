/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages 최적화 설정
  output: 'export',
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true
  },
  // 빌드 최적화
  swcMinify: true,
  // TypeScript 설정
  typescript: {
    ignoreBuildErrors: false
  },
  // ESLint 설정
  eslint: {
    ignoreDuringBuilds: false
  },
  // 정적 파일 최적화
  generateBuildId: async () => {
    return 'build-' + Date.now()
  }
}

module.exports = nextConfig
