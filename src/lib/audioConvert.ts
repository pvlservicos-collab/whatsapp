/**
 * Converte áudio gravado no navegador (webm/opus ou mp4/aac) pro formato que a Meta
 * exige nas suas APIs oficiais (WhatsApp Cloud API e Instagram Direct): Ogg com codec
 * Opus puro, sem parâmetros extras no Content-Type. O navegador grava em audio/webm
 * (Chrome/Edge) ou audio/mp4 (Safari) — a Meta rejeita o webm com "Unsupported MIME
 * type" (erro 131053 documentado). A Evolution API (WhatsApp Nº2) já faz essa
 * conversão no próprio servidor dela, então isso só é chamado pros canais da Meta.
 */
import { spawn } from 'node:child_process'
import { writeFile, readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import { storagePut } from '@/lib/storage'

// Trava de segurança contra um ffmpeg genuinamente travado (arquivo corrompido, etc).
// Deliberadamente maior que o kill_timeout do PM2 (30s) — nesse cenário normal de
// restart, o processo já vai ter sido reaproveitado (órfão) e terminado sozinho
// bem antes disso; esse timeout só existe pra cobrir o caso em que nada mais mata
// o processo (ver ecosystem.config.js: treekill:false deixa de contar com o PM2
// pra fazer essa limpeza como efeito colateral, como fazia antes).
const FFMPEG_TIMEOUT_MS = 60_000
const RETRY_DELAY_MS = 2_000

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg não disponível neste ambiente.'))
      return
    }
    const proc = spawn(ffmpegPath, args)
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
    }, FFMPEG_TIMEOUT_MS)
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    proc.on('error', (err) => { clearTimeout(timer); reject(err) })
    proc.on('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) { resolve(); return }
      const err = new Error(`ffmpeg falhou (código ${code}${signal ? `, sinal ${signal}` : ''}): ${stderr.slice(-500)}`)
      // "external-signal" = algo de fora matou o processo (ex: restart do PM2
      // pegando o ffmpeg no meio da conversão) — vale tentar de novo. Um código
      // de saída não-zero sem sinal é o próprio ffmpeg recusando o conteúdo
      // (arquivo inválido) — determinístico, tentar de novo não muda nada.
      ;(err as any).reason = timedOut ? 'timeout' : signal ? 'external-signal' : 'exit-code'
      reject(err)
    })
  })
}

async function runFfmpegWithRetry(args: string[]): Promise<void> {
  try {
    await runFfmpeg(args)
  } catch (err: any) {
    if (err?.reason !== 'external-signal') throw err
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    await runFfmpeg(args)
  }
}

export async function convertAudioForMeta(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`Falha ao baixar áudio original (HTTP ${res.status})`)
  const inputBuffer = Buffer.from(await res.arrayBuffer())

  const tmpId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const inputPath = join(tmpdir(), `audio-in-${tmpId}`)
  const outputPath = join(tmpdir(), `audio-out-${tmpId}.ogg`)

  await writeFile(inputPath, inputBuffer)

  try {
    // -c:a libopus sempre recodifica (não usa -c copy): garante saída Ogg/Opus válida
    // não importa o container/codec de origem (webm+opus do Chrome, mp4+aac do Safari).
    await runFfmpegWithRetry([
      '-y',
      '-i', inputPath,
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-ar', '48000',
      '-ac', '1',
      '-f', 'ogg',
      outputPath,
    ])

    const outputBuffer = await readFile(outputPath)
    return await storagePut(`chat-media/audio-meta/${tmpId}.ogg`, outputBuffer, 'audio/ogg')
  } finally {
    await Promise.allSettled([unlink(inputPath), unlink(outputPath)])
  }
}
