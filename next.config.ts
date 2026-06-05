import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      // Vercel Blob URLs
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      // Avatares do WhatsApp vindos do Uazapi
      { protocol: 'https', hostname: '*.uazapi.com' },
    ],
  },
  // Variáveis de ambiente que precisam ser acessíveis no cliente
  env: {
    NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  },
}

export default config
