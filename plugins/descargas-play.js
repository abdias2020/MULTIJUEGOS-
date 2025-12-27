// 🎧 Comando /play — Búsqueda y descarga inteligente (ACTUALIZADO 2025)

import { ogmp3 } from '../lib/youtubedl.js'
import { savetube } from '../lib/yt-savetube.js'
import { amdl, ytdown } from '../lib/scraper.js'
import yts from 'yt-search'
import fetch from 'node-fetch'

const userRequests = {}
const userSelections = {}
const TIMEOUT = 35000

const youtubeRegexID =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/

// =========================
// 📦 AUDIO APIs
// =========================
const AudioAPIs = {
  savetube_mp3: async (url) => {
    const data = await savetube.download(url, 'mp3')
    if (!data.status) throw new Error(data.error)
    return {
      url: data.result.download,
      source: 'SaveTube MP3',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      duration: data.result.duration
    }
  },

  ogmp3_320: async (url) => {
    const data = await ogmp3.download(url, '320', 'audio')
    if (!data?.result?.download) throw new Error('ogmp3 falló')
    return {
      url: data.result.download,
      source: 'OGMp3 320kbps',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      quality: '320kbps'
    }
  },

  ytdown_audio: async (url) => {
    const res = await ytdown.download(url, 'mp3')
    return { url: res.download, source: 'YTDown', title: res.title }
  }
}

// =========================
// 📦 VIDEO APIs
// =========================
const VideoAPIs = {
  savetube_720: async (url) => {
    const data = await savetube.download(url, '720')
    if (!data.status) throw new Error(data.error)
    return {
      url: data.result.download,
      source: 'SaveTube 720p',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      quality: '720p'
    }
  },

  ogmp3_720: async (url) => {
    const data = await ogmp3.download(url, '720', 'video')
    if (!data?.result?.download) throw new Error('ogmp3 video falló')
    return {
      url: data.result.download,
      source: 'OGMp3 720p',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      quality: '720p'
    }
  },

  ytdown_video: async (url) => {
    const res = await ytdown.download(url, 'mp4')
    return {
      url: res.download,
      source: 'YTDown',
      title: res.title,
      thumbnail: res.thumbnail,
      quality: '720p'
    }
  }
}

// =========================
// 🔄 Fallback inteligente
// =========================
async function downloadWithFallback(url, apis) {
  for (const api of Object.values(apis)) {
    try {
      return await Promise.race([
        api(url),
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), TIMEOUT))
      ])
    } catch {}
  }
  throw new Error('Todas las APIs fallaron')
}

// =========================
// 📋 Info del video
// =========================
async function getVideoInfo(url) {
  try {
    const data = await savetube.getAllFormats(url)
    if (data.status) {
      return {
        title: data.result.title,
        author: data.result.author,
        duration: data.result.duration,
        thumbnail: data.result.thumbnail,
        url
      }
    }
  } catch {}

  const search = await yts(url)
  return search.videos?.[0] || null
}

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

  if (userRequests[m.sender]) {
    return m.reply('⏳ Ya tienes una búsqueda en curso...')
  }

  userRequests[m.sender] = true

  try {
    const query = text.trim()
    const match = query.match(youtubeRegexID)
    const searchQuery = match ? `https://youtu.be/${match[1]}` : query

    const results = await yts(searchQuery)
    const video = results.videos?.[0]
    if (!video) throw new Error('No se encontró el video')

    const info = await getVideoInfo(video.url)

    userSelections[m.sender] = {
      video: info || video,
      time: Date.now()
    }

    setTimeout(() => delete userSelections[m.sender], 120000)

    await conn.sendMessage(m.chat, {
      image: { url: video.thumbnail },
      caption:
        `🎵 *${video.title}*\n\n` +
        `Responde:\n` +
        `• *1* o *mp3* → Audio\n` +
        `• *2* o *mp4* → Video\n\n` +
        `_Tienes 2 minutos_`
    }, { quoted: m })

  } catch (e) {
    await m.reply(`❌ Error: ${e.message}`)
  } finally {
    delete userRequests[m.sender]
  }
}

// =========================
// 🎵 AUDIO
// =========================
async function downloadAudio(m, conn, selection) {
  const { video } = selection
  userRequests[m.sender] = true
  delete userSelections[m.sender]

  try {
    const res = await downloadWithFallback(video.url, AudioAPIs)
    await conn.sendMessage(m.chat, {
      audio: { url: res.url },
      mimetype: 'audio/mpeg',
      fileName: `${sanitize(video.title)}.mp3`
    }, { quoted: m })
  } finally {
    delete userRequests[m.sender]
  }
}

// =========================
// 🎬 VIDEO
// =========================
async function downloadVideo(m, conn, selection) {
  const { video } = selection
  userRequests[m.sender] = true
  delete userSelections[m.sender]

  try {
    const res = await downloadWithFallback(video.url, VideoAPIs)
    await conn.sendMessage(m.chat, {
      video: { url: res.url },
      mimetype: 'video/mp4',
      fileName: `${sanitize(video.title)}.mp4`
    }, { quoted: m })
  } finally {
    delete userRequests[m.sender]
  }
}

// =========================
// 🔔 BEFORE (SELECCIÓN)
// =========================
handler.before = async (m, { conn }) => {
  const sel = userSelections[m.sender]
  if (!sel) return

  const input = (m.text || '').toLowerCase().trim()
  if (!input) return

  if (['1', 'mp3', 'audio'].includes(input)) {
    await downloadAudio(m, conn, sel)
    return true
  }

  if (['2', 'mp4', 'video'].includes(input)) {
    await downloadVideo(m, conn, sel)
    return true
  }

  await m.reply('❌ Opción inválida. Usa *1* o *2*')
  return true
}

// =========================
// ⚙️ UTILS
// =========================
function sanitize(t) {
  return t.replace(/[\\/:*?"<>|]/g, '').slice(0, 180)
}

handler.command = ['play', 'musica', 'audio']
handler.tags = ['downloader']
handler.help = ['play <canción>']
handler.limit = false

export default handler