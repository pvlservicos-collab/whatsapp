/**
 * Upload de arquivos direto do navegador para o MinIO (S3-compatible).
 *
 * O navegador pede uma URL pré-assinada em /api/upload (JSON, rápido) e depois
 * faz PUT direto nela — o arquivo não passa pelo nosso servidor Next.js.
 */
'use client'

export type UploadFolder = 'avatars' | 'org-logos' | 'chat-media'

// Mesmos tipos cobertos pelo antigo normalizeImageOrientation() do servidor (agora feito
// aqui no cliente, já que o arquivo não passa mais pelo nosso backend antes do upload).
const ROTATABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Corrige o "grava deitado, mostra em pé" clássico de foto de celular: a câmera grava a
 * tag EXIF de orientação em vez de rotacionar os pixels, e o navegador aplica essa tag ao
 * exibir — mas serviços que baixam a imagem depois (Evolution API, WhatsApp) podem não
 * respeitar essa tag. Decodificar respeitando a orientação e redesenhar em canvas grava os
 * pixels já corretos, sem tag, garantindo exibição correta em qualquer lugar.
 */
async function normalizeImageOrientation(file: File): Promise<File> {
  if (!ROTATABLE_IMAGE_TYPES.includes(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type))
    if (!blob) return file
    return new File([blob], file.name, { type: file.type })
  } catch (err) {
    console.error('[upload] Falha ao normalizar orientação EXIF, enviando arquivo original:', err)
    return file
  }
}

/**
 * Envia um arquivo direto pro MinIO e retorna a URL pública.
 */
export async function uploadClientFile(file: File, folder: UploadFolder, identifier: string): Promise<string> {
  const normalized = await normalizeImageOrientation(file)
  const ext = normalized.name.split('.').pop() || 'bin'
  const filename = `${identifier}_${Date.now()}.${ext}`
  const contentType = normalized.type || 'application/octet-stream'

  const tokenRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, filename, contentType }),
  })
  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}))
    throw new Error(err.error || 'Falha ao autorizar upload.')
  }
  const { uploadUrl, publicUrl, maxSize } = await tokenRes.json()

  if (typeof maxSize === 'number' && normalized.size > maxSize) {
    throw new Error(`Arquivo muito grande. Máximo: ${Math.round(maxSize / 1024 / 1024)}MB.`)
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: normalized,
  })
  if (!putRes.ok) throw new Error('Falha ao enviar arquivo para o storage.')

  return publicUrl
}
