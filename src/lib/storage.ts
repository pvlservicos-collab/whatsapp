import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const ENDPOINT = process.env.MINIO_ENDPOINT!
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY!
const SECRET_KEY = process.env.MINIO_SECRET_KEY!
const BUCKET = process.env.MINIO_BUCKET ?? 'naturabelas'
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL!

export const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
})

/** Faz upload de um Buffer e retorna a URL pública do arquivo. */
export async function storagePut(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  }))
  return `${PUBLIC_URL}/${BUCKET}/${key}`
}

/** Remove um arquivo pelo path/key. */
export async function storageDelete(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/**
 * Gera uma URL pré-assinada para upload direto do navegador.
 * O cliente faz PUT nessa URL com o arquivo; expira em 5 minutos.
 */
export async function storagePresignedPut(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  })
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 })
  const publicUrl = `${PUBLIC_URL}/${BUCKET}/${key}`
  return { uploadUrl, publicUrl }
}
