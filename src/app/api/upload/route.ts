/**
 * POST /api/upload
 * Substitui Supabase Storage (buckets 'avatars' e 'org-logos')
 * Usa Vercel Blob para armazenar arquivos
 */
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { uploadFile } from '@/lib/blob'
import { apiError } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return apiError(401, 'Não autenticado.')

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = formData.get('folder') as string | null
    const identifier = formData.get('identifier') as string | null

    if (!file) return apiError(400, 'Arquivo não enviado.')
    if (!folder || !['avatars', 'org-logos', 'chat-media'].includes(folder)) {
      return apiError(400, 'Pasta inválida. Use: avatars, org-logos ou chat-media')
    }

    if (folder === 'chat-media') {
      // Validar tamanho (16MB máx — limite do WhatsApp para mídia)
      if (file.size > 16 * 1024 * 1024) {
        return apiError(400, 'Arquivo muito grande. Máximo: 16MB.')
      }
    } else {
      // Validar tamanho (5MB máx)
      if (file.size > 5 * 1024 * 1024) {
        return apiError(400, 'Arquivo muito grande. Máximo: 5MB.')
      }

      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        return apiError(400, 'Tipo de arquivo inválido. Use: JPEG, PNG, WebP ou GIF.')
      }
    }

    const url = await uploadFile(
      file,
      folder as 'avatars' | 'org-logos' | 'chat-media',
      identifier || session.user.id!
    )

    return Response.json({ url })
  } catch (err: any) {
    console.error('[/api/upload]', err)
    return apiError(500, err.message || 'Erro ao fazer upload.')
  }
}
