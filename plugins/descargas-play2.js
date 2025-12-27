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

  throw new Error(`Todas las APIs fallaron:\n${errors.slice(0, 3).join('\n')}`)
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
      return { url: r.result.download, title: r.result.title }
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
      if (!r?.download) throw new Error('YTDown falló')
      return { url: r.download, title: r.title }
    }
  },
  {
    name: 'YTDL-Core',
    download: async (url) => {
      const info = await ytdl.getInfo(url)
      const format = ytdl.chooseFormat(info.formats, { 
        quality: 'highestaudio',
        filter: 'audioonly' 
      })
      if (!format?.url) throw new Error('YTDL-Core falló')
      return { url: format.url, title: info.videoDetails.title }
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
      if (!r?.download) throw new Error('YTDown falló')
      return { url: r.download, title: r.title, quality: '720p' }
    }
  },
  {
    name: 'YTDL-Core',
    download: async (url) => {
      const info = await ytdl.getInfo(url)
      const format = ytdl.chooseFormat(info.formats, { 
        quality: 'highest',
        filter: format => format.hasVideo && format.hasAudio 
      })
      if (!format?.url) throw new Error('YTDL-Core falló')
      return { 
        url: format.url, 
        title: info.videoDetails.title,
        quality: format.qualityLabel || '720p'
      }
    }
  }
]

/* =======================
   🎯 HANDLER PRINCIPAL
======================= */
const handler = async (m, { conn, text, command }) => {
  // Validar entrada
  if (!text?.trim()) {
    return m.reply(
      `📌 *Uso correcto:*\n\n` +
      `• *ytmp3* <url> → Audio MP3\n` +
      `• *ytmp4* <url> → Video MP4\n` +
      `• *ytmp3doc* <url> → Audio como documento\n` +
      `• *ytmp4doc* <url> → Video como documento\n\n` +
      `_Ejemplo: ytmp3 https://youtu.be/xxxxx_`
    )
  }

  // Validar URL de YouTube
  if (!/youtu\.?be/.test(text)) {
    return m.reply('❌ Proporciona un enlace válido de YouTube')
  }

  // Verificar solicitudes en curso
  if (userRequests[m.sender]) {
    return m.reply('⏳ Ya tienes una descarga en proceso. Espera a que termine...')
  }

  userRequests[m.sender] = true

  try {
    // Determinar tipo de descarga
    const isAudio = /ytmp3|yta/i.test(command)
    const isDoc = /doc/i.test(command)

    // Obtener información del video
    let info, title, thumb
    try {
      info = await ytdl.getInfo(text)
      title = sanitize(info.videoDetails.title)
      thumb = info.videoDetails.thumbnails.at(-1)?.url || null
    } catch (e) {
      // Fallback con yt-search si ytdl falla
      const search = await yts({ videoId: ytdl.getVideoID(text) })
      title = sanitize(search.title)
      thumb = search.thumbnail
    }

    // Mensaje de inicio
    await m.reply(
      `⬇️ *Descargando...*\n\n` +
      `📝 *Título:* ${title}\n` +
      `🎵 *Formato:* ${isAudio ? 'MP3 Audio' : 'MP4 Video'}\n\n` +
      `_Esto puede tomar unos segundos..._`
    )
    m.react('⏳')

    // Descargar según el tipo
    if (isAudio) {
      // 🎵 DESCARGA DE AUDIO
      const res = await downloadWithFallback(text, AudioAPIs)

      await conn.sendMessage(m.chat, {
        [isDoc ? 'document' : 'audio']: { url: res.url },
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
        ...(isDoc && { caption: `🎵 *${title}*\n📦 API: ${res.apiUsed}` })
      }, { quoted: m })

      m.react('✅')
      
    } else {
      // 🎬 DESCARGA DE VIDEO
      const res = await downloadWithFallback(text, VideoAPIs)

      await conn.sendMessage(m.chat, {
        [isDoc ? 'document' : 'video']: { url: res.url },
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`,
        caption: `🎬 *${title}*\n📺 Calidad: ${res.quality || '720p'}\n⚙️ API: ${res.apiUsed}`
      }, { quoted: m })

      m.react('✅')
    }

  } catch (e) {
    m.react('❌')
    await m.reply(
      `❌ *Error en la descarga*\n\n` +
      `📋 Detalles: ${e.message}\n\n` +
      `💡 *Posibles soluciones:*\n` +
      `• Verifica que el enlace sea válido\n` +
      `• Intenta con otro video\n` +
      `• El video puede estar restringido`
    )
  } finally {
    delete userRequests[m.sender]
  }
}

/* =======================
   ⚙️ CONFIGURACIÓN
======================= */
handler.command = /^(ytmp3|ytmp4|ytmp3doc|ytmp4doc|yta|ytv)$/i
handler.tags = ['downloader']
handler.help = [
  'ytmp3 <url> - Descargar audio MP3',
  'ytmp4 <url> - Descargar video MP4',
  'ytmp3doc <url> - Audio como documento',
  'ytmp4doc <url> - Video como documento'
]
handler.limit = true

export default handler

/* =======================
   🛠️ UTILIDADES
======================= */
function sanitize(t) {
  return t
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}