/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages 설정 (빌드 시에만 적용)
  // 개발 모드에서는 output: 'export'를 사용하지 않음
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export',
  }),
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // 빌드 최적화
  swcMinify: true,
  // TypeScript 설정
  typescript: {
    ignoreBuildErrors: false
  },
  // ESLint 설정 (빌드 시 경고만 표시, 에러로 빌드 실패하지 않음)
  eslint: {
    ignoreDuringBuilds: true
  },
  // 정적 파일 최적화
  generateBuildId: async () => {
    return 'build-' + Date.now()
  }
}

module.exports = nextConfig
