import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError } from '@/lib/api-auth'
import { storagePresignedPut } from '@/lib/storage'
import { randomBytes } from 'crypto'

const FOLDER_LIMITS: Record<string, { maxSize: number; allowedTypes?: string[] }> = {
  avatars:    { maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  'org-logos':{ maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  'chat-media':{ maxSize: 16 * 1024 * 1024 },
}

/**
 * POST /api/upload
 * Gera uma URL pré-assinada para upload direto do navegador ao MinIO.
 * Body: { pathname: string; contentType: string; size: number }
 * Retorna: { uploadUrl, publicUrl }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return apiError(401, 'Não autenticado.')

    const { pathname, contentType, size } = await req.json()
    if (!pathname || !contentType) return apiError(400, 'pathname e contentType são obrigatórios.')

    const folder = pathname.split('/')[0]
    const limits = FOLDER_LIMITS[folder]
    if (!limits) return apiError(400, 'Pasta inválida. Use: avatars, org-logos ou chat-media')

    if (limits.allowedTypes && !limits.allowedTypes.includes(contentType)) {
      return apiError(400, `Tipo não permitido para ${folder}. Aceitos: ${limits.allowedTypes.join(', ')}`)
    }
    if (size && size > limits.maxSize) {
      return apiError(400, `Arquivo muito grande. Máximo: ${limits.maxSize / 1024 / 1024}MB`)
    }

    // Garante nome único
    const ext = pathname.split('.').pop() || 'bin'
    const uniqueKey = `${folder}/${randomBytes(8).toString('hex')}_${Date.now()}.${ext}`

    const { uploadUrl, publicUrl } = await storagePresignedPut(uniqueKey, contentType, limits.maxSize)
    return Response.json({ uploadUrl, publicUrl, url: publicUrl })
  } catch (err: any) {
    console.error('[/api/upload]', err)
    return apiError(500, err.message || 'Erro ao gerar URL de upload.')
  }
}
