/**
 * Upload de arquivos direto do navegador para o MinIO via URL pré-assinada.
 *
 * Fluxo: cliente → POST /api/upload (obtém uploadUrl + publicUrl) →
 *        cliente → PUT uploadUrl (envia bytes direto ao MinIO, sem passar pelo servidor)
 *
 * Isso contorna qualquer limite de body do servidor e é equivalente ao que o
 * Vercel Blob client fazia, agora apontando para nosso próprio MinIO no VPS.
 */
'use client'

export type UploadFolder = 'avatars' | 'org-logos' | 'chat-media'

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
 * Envia um arquivo direto para o MinIO e retorna a URL pública.
 * Substitui o antigo `upload()` do @vercel/blob/client.
 */
export async function uploadClientFile(file: File, folder: UploadFolder, identifier: string): Promise<string> {
  const normalized = await normalizeImageOrientation(file)
  const contentType = normalized.type || 'application/octet-stream'
  const ext = normalized.name.split('.').pop() || 'bin'
  const pathname = `${folder}/${identifier}_${Date.now()}.${ext}`

  // 1. Pede URL pré-assinada ao servidor
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pathname, contentType, size: normalized.size }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `Falha ao obter URL de upload (HTTP ${res.status})`)
  }
  const { uploadUrl, publicUrl } = await res.json()

  // 2. Envia bytes direto ao MinIO
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: normalized,
  })
  if (!put.ok) throw new Error(`Falha ao enviar arquivo ao storage (HTTP ${put.status})`)

  return publicUrl
}
