/** @type {import('next').NextConfig} */
const nextConfig = {
  // 클라우드플레어 페이지용 설정
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
