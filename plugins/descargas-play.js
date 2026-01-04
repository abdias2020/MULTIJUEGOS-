// 🎧 /play — MULTIJUEGOS DOWNLOADER PRO (2026)

import yts from 'yt-search'
import { ogmp3 } from '../lib/youtubedl.js'
import { savetube } from '../lib/yt-savetube.js'
import { ytdown } from '../lib/scraper.js'

const sessions = {}
const TIMEOUT = 35000

const ytID =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/

// =========================
// 🔄 FALLBACK ENGINE (estilo Python)
// =========================
async function withFallback(url, apis) {
  for (const api of apis) {
    try {
      return await Promise.race([
        api(url),
        new Promise((_, r) =>
          setTimeout(() => r(new Error('Timeout')), TIMEOUT)
        )
      ])
    } catch {}
  }
  throw new Error('Todos los métodos fallaron')
}

// =========================
// 🎵 AUDIO APIs
// =========================
const AudioAPIs = [
  async (url) => {
    const r = await savetube.download(url, 'mp3')
    if (!r?.status) throw 'SaveTube MP3 falló'
    return { url: r.result.download, source: 'SaveTube MP3' }
  },
  async (url) => {
    const r = await ogmp3.download(url, '320', 'audio')
    if (!r?.result?.download) throw 'OGMp3 320 falló'
    return { url: r.result.download, source: 'OGMp3 320kbps' }
  },
  async (url) => {
    const r = await ytdown.download(url, 'mp3')
    return { url: r.download, source: 'YTDown MP3' }
  }
]

// =========================
// 🖥️ VIDEO APIs
// =========================
const VideoAPIs = [
  async (url) => {
    const r = await savetube.download(url, '720')
    if (!r?.status) throw 'SaveTube 720 falló'
    return { url: r.result.download, source: 'SaveTube 720p' }
  },
  async (url) => {
    const r = await ogmp3.download(url, '720', 'video')
    if (!r?.result?.download) throw 'OGMp3 video falló'
    return { url: r.result.download, source: 'OGMp3 720p' }
  },
  async (url) => {
    const r = await ytdown.download(url, 'mp4')
    return { url: r.download, source: 'YTDown MP4' }
  }
]

// =========================
// 🎯 HANDLER PRINCIPAL
// =========================
const handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text?.trim()) {
    return m.reply(
      `🎧 *Uso correcto:*\n\n` +
      `${usedPrefix + command} nombre de la canción\n` +
      `${usedPrefix + command} link de YouTube`
    )
  }

  if (sessions[m.sender]) return
  sessions[m.sender] = {}

  try {
    const query = text.trim()
    const match = query.match(ytID)
    const search = match
      ? `https://youtu.be/${match[1]}`
      : query

    const res = await yts(search)
    const video = res.videos?.[0]
    if (!video) throw 'No se encontraron resultados'

    sessions[m.sender].video = video

    const info =
      `🎵 *${video.title}*\n` +
      `👤 Canal: ${video.author.name}\n` +
      `⏱️ Duración: ${video.timestamp}\n` +
      `👁️ Vistas: ${video.views.toLocaleString()}\n` +
      `📅 Publicado: ${video.ago}\n\n` +
      `👉 *¿En qué formato lo quieres?*\n\n` +
      `🎵 audio\n🖥️ video`

    await conn.sendMessage(
      m.chat,
      {
        image: { url: video.thumbnail },
        caption: info
      },
      { quoted: m }
    )

    setTimeout(() => delete sessions[m.sender], 120000)

  } catch (e) {
    delete sessions[m.sender]
    m.reply(`❌ Error: ${e}`)
  }
}

// =========================
// 🔔 RESPUESTA DE FORMATO
// =========================
handler.before = async (m, { conn }) => {
  const s = sessions[m.sender]
  if (!s?.video) return

  const txt = m.text?.toLowerCase().trim()
  if (!txt) return

  try {
    if (txt.includes('audio')) {
      delete sessions[m.sender]
      const r = await withFallback(s.video.url, AudioAPIs)

      return conn.sendMessage(
        m.chat,
        {
          audio: { url: r.url },
          mimetype: 'audio/mpeg',
          fileName: `${sanitize(s.video.title)}.mp3`
        },
        { quoted: m }
      )
    }

    if (txt.includes('video')) {
      delete sessions[m.sender]
      const r = await withFallback(s.video.url, VideoAPIs)

      return conn.sendMessage(
        m.chat,
        {
          video: { url: r.url },
          mimetype: 'video/mp4',
          fileName: `${sanitize(s.video.title)}.mp4`
        },
        { quoted: m }
      )
    }
  } catch (e) {
    delete sessions[m.sender]
    m.reply('❌ No se pudo descargar el archivo')
  }
}

// =========================
// 🧹 UTILS
// =========================
function sanitize(t) {
  return t.replace(/[\\/:*?"<>|]/g, '').slice(0, 180)
}

handler.command = ['play', 'musica']
handler.tags = ['downloader']
handler.help = ['play <texto o link>']
handler.limit = false

export default handler