/** @type {import('next').NextConfig} */
const nextConfig = {
  // 클라우드플레어 페이지용 설정
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // API 라우트 비활성화 (정적 사이트용)
  experimental: {
    appDir: true
  },
  // 빌드 최적화
  swcMinify: true,
  // 정적 파일 최적화
  generateBuildId: async () => {
    return 'build-' + Date.now()
  }
}

module.exports = nextConfig
