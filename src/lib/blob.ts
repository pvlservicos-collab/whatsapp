/**
 * Vercel Blob — substitui Supabase Storage
 *
 * Buckets equivalentes:
 *   Supabase: 'avatars'    →  Vercel Blob: prefixo 'avatars/'
 *   Supabase: 'org-logos'  →  Vercel Blob: prefixo 'org-logos/'
 *
 * Uso (Server Action ou API Route):
 *   import { uploadFile, deleteFile } from '@/lib/blob'
 *   const url = await uploadFile(file, 'avatars', userId)
 */
import { put, del } from '@vercel/blob'

/**
 * Faz upload de um arquivo e retorna a URL pública.
 * @param file - Arquivo a ser enviado
 * @param folder - Pasta/prefixo ('avatars' | 'org-logos')
 * @param identifier - ID único para compor o nome do arquivo
 */
export async function uploadFile(
  file: File | Blob,
  folder: 'avatars' | 'org-logos' | 'chat-media',
  identifier: string
): Promise<string> {
  const ext = file instanceof File ? file.name.split('.').pop() || 'jpg' : 'jpg'
  const filename = `${folder}/${identifier}_${Date.now()}.${ext}`

  const blob = await put(filename, file, {
    access: 'public',
    contentType: file.type || 'image/jpeg',
  })

  return blob.url
}

/**
 * Deleta um arquivo do Vercel Blob pela URL.
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    await del(url)
  } catch (err) {
    console.error('[Blob] Falha ao deletar arquivo:', err)
  }
}
