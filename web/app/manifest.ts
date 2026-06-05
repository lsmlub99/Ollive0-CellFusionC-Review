import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '셀퓨전씨 인사이트',
    short_name: 'CFC 인사이트',
    description: '올리브영·쿠팡·네이버 브랜드 인사이트 대시보드',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAF9',
    theme_color: '#FAFAF9',
    orientation: 'portrait-primary',
    icons: [
      { src: '/CFC.png', sizes: '192x192', type: 'image/png' },
      { src: '/CFC.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
