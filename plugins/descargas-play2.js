// 🎧 YTMP3 / YTMP4 — MULTIJUEGOS DOWNLOADER 2026

import ytdl from 'ytdl-core'
import { savetube } from '../lib/yt-savetube.js'
import { ogmp3 } from '../lib/youtubedl.js'
import { ytdown } from '../lib/scraper.js'

const active = {}
const TIMEOUT = 35000

/* =======================
   🔄 FALLBACK ESTILO PYTHON
======================= */
async function fallbackDownload(url, apis) {
  for (const api of apis) {
    try {
      const res = await Promise.race([
        api(url),
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), TIMEOUT))
      ])
      if (res?.url) return res
    } catch {}
  }
  throw new Error('Todos los métodos fallaron')
}

/* =======================
   📦 APIs AUDIO
======================= */
const AudioAPIs = [
  async (url) => {
    const r = await savetube.download(url, 'mp3')
    if (!r?.status) throw 'SaveTube MP3 falló'
    return { url: r.result.download, title: r.result.title }
  },
  async (url) => {
    const r = await ogmp3.download(url, '320', 'audio')
    if (!r?.result?.download) throw 'OGMP3 falló'
    return { url: r.result.download, title: r.result.title }
  },
  async (url) => {
    const r = await ytdown.download(url, 'mp3')
    if (!r?.download) throw 'YTDown falló'
    return { url: r.download, title: r.title }
  },
  async (url) => {
    const info = await ytdl.getInfo(url)
    const f = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly'
    })
    if (!f?.url) throw 'YTDL falló'
    return { url: f.url, title: info.videoDetails.title }
  }
]

/* =======================
   📦 APIs VIDEO
======================= */
const VideoAPIs = [
  async (url) => {
    const r = await savetube.download(url, '720')
    if (!r?.status) throw 'SaveTube 720 falló'
    return { url: r.result.download, title: r.result.title }
  },
  async (url) => {
    const r = await ogmp3.download(url, '720', 'video')
    if (!r?.result?.download) throw 'OGMP3 Video falló'
    return { url: r.result.download, title: r.result.title }
  },
  async (url) => {
    const r = await ytdown.download(url, 'mp4')
    if (!r?.download) throw 'YTDown MP4 falló'
    return { url: r.download, title: r.title }
  },
  async (url) => {
    const info = await ytdl.getInfo(url)
    const f = ytdl.chooseFormat(info.formats, {
      quality: 'highest',
      filter: f => f.hasVideo && f.hasAudio
    })
    if (!f?.url) throw 'YTDL falló'
    return { url: f.url, title: info.videoDetails.title }
  }
]

/* =======================
   🎯 HANDLER
======================= */
const handler = async (m, { conn, text, command }) => {
  if (!text || !/youtu\.?be/.test(text)) {
    return m.reply('❌ Usa un link válido de YouTube')
  }

  if (active[m.sender]) {
    return m.reply('⏳ Ya tienes una descarga en curso')
  }

  active[m.sender] = true
  const isAudio = /ytmp3|yta/i.test(command)

  try {
    m.react('⏳')

    const res = isAudio
      ? await fallbackDownload(text, AudioAPIs)
      : await fallbackDownload(text, VideoAPIs)

    await conn.sendMessage(
      m.chat,
      isAudio
        ? {
            audio: { url: res.url },
            mimetype: 'audio/mpeg',
            fileName: `${sanitize(res.title)}.mp3`
          }
        : {
            video: { url: res.url },
            mimetype: 'video/mp4',
            fileName: `${sanitize(res.title)}.mp4`,
            caption: `🎬 ${res.title}`
          },
      { quoted: m }
    )

    m.react('✅')

  } catch (e) {
    m.react('❌')
    m.reply('❌ No se pudo descargar el video')
  } finally {
    delete active[m.sender]
  }
}

/* =======================
   ⚙️ CONFIG
======================= */
handler.command = /^(ytmp3|ytmp4|yta|ytv)$/i
handler.tags = ['downloader']
handler.help = [
  'ytmp3 <link>',
  'ytmp4 <link>'
]
handler.limit = true

export default handler

/* =======================
   🧹 UTILS
======================= */
function sanitize(t) {
  return t.replace(/[\\/:*?"<>|]/g, '').slice(0, 180)
}