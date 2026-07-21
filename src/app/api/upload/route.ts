/**
 * POST /api/upload
 * Emite uma URL pré-assinada de upload direto-pro-MinIO.
 *
 * O arquivo NÃO passa por essa function — o navegador faz PUT direto na URL
 * assinada que essa rota devolve. Ver src/lib/blobClient.ts para o lado cliente.
 */
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-auth'
import { storagePresignedPut } from '@/lib/storage'

const FOLDER_LIMITS: Record<string, { maxSize: number; allowedTypes?: string[] }> = {
  avatars: { maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  'org-logos': { maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  // 16MB — limite de mídia do WhatsApp
  'chat-media': {
    maxSize: 16 * 1024 * 1024,
    allowedTypes: [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/wav', 'audio/aac',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf',
    ],
  },
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return apiError(401, 'Não autenticado.')

    const { folder, filename, contentType } = await req.json()

    const limits = FOLDER_LIMITS[folder]
    if (!limits) return apiError(400, 'Pasta inválida. Use: avatars, org-logos ou chat-media')

    if (!filename || typeof filename !== 'string') return apiError(400, 'Nome de arquivo inválido.')

    if (limits.allowedTypes && !limits.allowedTypes.includes(contentType)) {
      return apiError(400, `Tipo de arquivo não permitido: ${contentType}`)
    }

    const key = `${folder}/${filename}`
    const { uploadUrl, publicUrl } = await storagePresignedPut(key, contentType || 'application/octet-stream')

    return Response.json({ uploadUrl, publicUrl, maxSize: limits.maxSize })
  } catch (err: any) {
    console.error('[/api/upload]', err)
    return apiError(400, err.message || 'Erro ao autorizar upload.')
  }
}
