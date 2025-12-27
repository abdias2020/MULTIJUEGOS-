// 🎧 Sistema de descarga YouTube MEJORADO y FUNCIONAL 2025

import fetch from 'node-fetch'
import yts from 'yt-search'
import ytdl from 'ytdl-core'
import { savetube } from '../lib/yt-savetube.js'
import { ogmp3 } from '../lib/youtubedl.js'
import { amdl, ytdown } from '../lib/scraper.js'

const userRequests = {}
const TIMEOUT = 35000

/* =======================
   🔄 FALLBACK INTELIGENTE
======================= */
async function downloadWithFallback(url, apis, quality = null) {
  const errors = []

  for (const api of apis) {
    try {
      const task = api.download.length >= 2
        ? api.download(url, quality)
        : api.download(url)

      const res = await Promise.race([
        task,
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), TIMEOUT))
      ])

      if (res?.url) return { ...res, apiUsed: api.name }
    } catch (e) {
      errors.push(`${api.name}: ${e.message}`)
    }
  }

  throw new Error(errors.slice(0, 3).join('\n'))
}

/* =======================
   📦 APIs AUDIO
======================= */
const AudioAPIs = [
  {
    name: 'SaveTube',
    download: async (url) => {
      const r = await savetube.download(url, 'mp3')
      if (!r.status) throw new Error('SaveTube falló')
      return r.result
    }
  },
  {
    name: 'OGMp3',
    download: async (url) => {
      const r = await ogmp3.download(url, '320', 'audio')
      if (!r?.result?.download) throw new Error('OGMp3 falló')
      return { url: r.result.download, title: r.result.title }
    }
  },
  {
    name: 'YTDown',
    download: async (url) => {
      const r = await ytdown.download(url, 'mp3')
      return { url: r.download, title: r.title }
    }
  },
  {
    name: 'YTDL-Core',
    download: async (url) => {
      const info = await ytdl.getInfo(url)
      const f = ytdl.chooseFormat(info.formats, { filter: 'audioonly' })
      return { url: f.url, title: info.videoDetails.title }
    }
  }
]

/* =======================
   📦 APIs VIDEO
======================= */
const VideoAPIs = [
  {
    name: 'SaveTube-720p',
    download: async (url) => {
      const r = await savetube.download(url, '720')
      if (!r.status) throw new Error('SaveTube falló')
      return { url: r.result.download, title: r.result.title, quality: '720p' }
    }
  },
  {
    name: 'OGMp3-Video',
    download: async (url) => {
      const r = await ogmp3.download(url, '720', 'video')
      if (!r?.result?.download) throw new Error('OGMp3 video falló')
      return { url: r.result.download, title: r.result.title, quality: '720p' }
    }
  },
  {
    name: 'YTDown',
    download: async (url) => {
      const r = await ytdown.download(url, 'mp4')
      return { url: r.download, title: r.title, quality: '720p' }
    }
  }
]

/* =======================
   🎯 HANDLER
======================= */
const handler = async (m, { conn, text, command }) => {
  if (!text) return m.reply('📌 Usa: ytmp3 <url> | ytmp4 <url>')

  if (userRequests[m.sender]) {
    return m.reply('⏳ Ya hay una descarga en proceso...')
  }

  userRequests[m.sender] = true

  try {
    if (!/youtu\.?be/.test(text)) {
      throw new Error('Enlace de YouTube inválido')
    }

    const isAudio = /ytmp3|yta/i.test(command)
    const isDoc = /doc/i.test(command)

    const info = await ytdl.getInfo(text)
    const title = sanitize(info.videoDetails.title)
    const thumb = info.videoDetails.thumbnails.at(-1)?.url

    m.react('⬇️')

    if (isAudio) {
      const res = await downloadWithFallback(text, AudioAPIs)

      await conn.sendMessage(m.chat, {
        [isDoc ? 'document' : 'audio']: { url: res.url },
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`
      }, { quoted: m })
    } else {
      const res = await downloadWithFallback(text, VideoAPIs)

      await conn.sendMessage(m.chat, {
        [isDoc ? 'document' : 'video']: { url: res.url },
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`,
        caption: `🎬 ${title}\n📺 ${res.quality}\n⚙️ ${res.apiUsed}`
      }, { quoted: m })
    }

    m.react('✅')

  } catch (e) {
    m.react('❌')
    await m.reply(`❌ Error:\n${e.message}`)
  } finally {
    delete userRequests[m.sender]
  }
}

handler.command = /^(ytmp3|ytmp4|ytmp3doc|ytmp4doc|yta|ytv)$/i
handler.tags = ['downloader']
handler.help = ['ytmp3 <url>', 'ytmp4 <url>']
handler.limit = true

export default handler

/* =======================
   🛠️ UTIL
======================= */
function sanitize(t) {
  return t.replace(/[<>:"/\\|?*]/g, '').slice(0, 180)
}