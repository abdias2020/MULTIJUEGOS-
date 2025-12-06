// 🎧 Sistema de descarga YouTube mejorado - ytmp3/ytmp4
import fetch from 'node-fetch'
import yts from 'yt-search'
import ytdl from 'ytdl-core'
import axios from 'axios'
import { savetube } from '../lib/yt-savetube.js'
import { ogmp3 } from '../lib/youtubedl.js'
import { amdl, ytdown } from '../lib/scraper.js'

const userRequests = {}
const TIMEOUT = 35000 // 35 segundos timeout

// 📦 APIs para AUDIO (20 APIs)
const AudioAPIs = [
  {
    name: 'SaveTube',
    download: async (url) => {
      const result = await savetube.download(url, 'mp3')
      return { url: result.result.download, title: result.result.title }
    }
  },
  {
    name: 'OGMp3',
    download: async (url) => {
      const data = await ogmp3.download(url, '320', 'audio')
      if (data?.status && data?.result?.download) {
        return { url: data.result.download, title: data.result.title }
      }
      throw new Error('OGMp3 falló')
    }
  },
  {
    name: 'AMDL',
    download: async (url) => {
      const response = await amdl.download(url, '720p')
      const { title, download } = response.result
      return { url: download, title }
    }
  },
  {
    name: 'YTDown',
    download: async (url) => {
      const response = await ytdown.download(url, 'mp3')
      return { url: response.download, title: response.title }
    }
  },
  {
    name: 'SiputZX',
    download: async (url) => {
      const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp3?url=${url}`)
      const { data } = await res.json()
      if (data?.dl) return { url: data.dl }
      throw new Error('SiputZX falló')
    }
  },
  {
    name: 'Agatz',
    download: async (url) => {
      const res = await fetch(`https://api.agatz.xyz/api/ytmp3?url=${url}`)
      const data = await res.json()
      if (data?.data?.downloadUrl) return { url: data.data.downloadUrl }
      throw new Error('Agatz falló')
    }
  },
  {
    name: 'ZenKey',
    download: async (url) => {
      const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp3?apikey=zenkey&url=${url}`)
      const { result } = await res.json()
      if (result?.download?.url) return { url: result.download.url }
      throw new Error('ZenKey falló')
    }
  },
  {
    name: 'Cobalt',
    download: async (url) => {
      const res = await fetch(`https://api.cobalt.tools/api/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, vQuality: 'max', aFormat: 'mp3' })
      })
      const data = await res.json()
      if (data?.status === 'success' && data?.url) return { url: data.url }
      throw new Error('Cobalt falló')
    }
  },
  {
    name: 'Y2Mate',
    download: async (url) => {
      const res = await fetch(`https://api-y2mate.com/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format: 'mp3', quality: '320' })
      })
      const data = await res.json()
      if (data?.downloadUrl) return { url: data.downloadUrl }
      throw new Error('Y2Mate falló')
    }
  },
  {
    name: 'SaveFrom',
    download: async (url) => {
      const res = await fetch(`https://api.savefrom.net/download?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      const audioUrl = data?.url?.find(item => item.type === 'audio')?.url
      if (audioUrl) return { url: audioUrl }
      throw new Error('SaveFrom falló')
    }
  },
  {
    name: 'Loader',
    download: async (url) => {
      const res = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (data?.download?.url) return { url: data.download.url }
      throw new Error('Loader falló')
    }
  },
  {
    name: 'SnapSave',
    download: async (url) => {
      const res = await fetch('https://snapsave.app/action.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}`
      })
      const data = await res.json()
      if (data?.downloadUrl) return { url: data.downloadUrl }
      throw new Error('SnapSave falló')
    }
  },
  {
    name: 'YTBmp3',
    download: async (url) => {
      const res = await fetch(`https://ytbmp3.com/api/convert?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (data?.download) return { url: data.download }
      throw new Error('YTBmp3 falló')
    }
  },
  {
    name: 'Converto',
    download: async (url) => {
      const res = await fetch(`https://converto.io/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await res.json()
      if (data?.url) return { url: data.url }
      throw new Error('Converto falló')
    }
  },
  {
    name: 'YTMate',
    download: async (url) => {
      const res = await fetch(`https://ytmate.app/api/convert?url=${encodeURIComponent(url)}&format=mp3`)
      const data = await res.json()
      if (data?.downloadUrl) return { url: data.downloadUrl }
      throw new Error('YTMate falló')
    }
  },
  {
    name: 'YT5s',
    download: async (url) => {
      const res = await fetch(`https://yt5s.com/api/ajaxConvert/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}&ftype=mp3&fquality=320`
      })
      const data = await res.json()
      if (data?.dlink) return { url: data.dlink }
      throw new Error('YT5s falló')
    }
  },
  {
    name: 'X2Download',
    download: async (url) => {
      const res = await fetch(`https://x2download.app/api/ajaxConvert`, {
        method: 'POST',
        body: new URLSearchParams({ url, format: 'mp3' })
      })
      const data = await res.json()
      if (data?.dlink) return { url: data.dlink }
      throw new Error('X2Download falló')
    }
  },
  {
    name: 'YT1s',
    download: async (url) => {
      const res = await fetch(`https://yt1s.com/api/ajaxConvert/convert`, {
        method: 'POST',
        body: new URLSearchParams({ url, ftype: 'mp3', fquality: '320' })
      })
      const data = await res.json()
      if (data?.dlink) return { url: data.dlink }
      throw new Error('YT1s falló')
    }
  },
  {
    name: 'YTDL-Core',
    download: async (url) => {
      const searchh = await yts(url)
      const __res = searchh.all.filter(v => v.type === "video")
      if (!__res[0]) throw new Error('No se encontró video')
      const infoo = await ytdl.getInfo('https://youtu.be/' + __res[0].videoId)
      const ress = await ytdl.chooseFormat(infoo.formats, { filter: 'audioonly' })
      return { url: ress.url, title: __res[0].title }
    }
  },
  {
    name: 'YouTubeMP3',
    download: async (url) => {
      const res = await fetch(`https://www.yt-download.org/api/button/mp3/${encodeURIComponent(url)}`)
      const data = await res.json()
      if (data?.dlink) return { url: data.dlink }
      throw new Error('YouTubeMP3 falló')
    }
  }
]

// 📦 APIs para VIDEO (18 APIs)
const VideoAPIs = [
  {
    name: 'SaveTube',
    download: async (url, quality = '720') => {
      const result = await savetube.download(url, quality)
      return { 
        url: result.result.download, 
        title: result.result.title,
        thumb: result.result.thumbnail 
      }
    }
  },
  {
    name: 'OGMp3',
    download: async (url, quality = '720') => {
      const res = await ogmp3.download(url, quality, 'video')
      if (res?.status && res?.result?.download) {
        return { url: res.result.download, title: res.result.title }
      }
      throw new Error('OGMp3 video falló')
    }
  },
  {
    name: 'AMDL',
    download: async (url, quality = '720p') => {
      const response = await amdl.download(url, quality)
      const { title, download, thumbnail } = response.result
      return { url: download, title, thumb: thumbnail }
    }
  },
  {
    name: 'YTDown',
    download: async (url) => {
      const response = await ytdown.download(url, 'mp4')
      return { 
        url: response.download, 
        title: response.title,
        thumb: response.thumbnail 
      }
    }
  },
  {
    name: 'SiputZX',
    download: async (url) => {
      const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp4?url=${url}`)
      const { data } = await res.json()
      if (data?.dl) return { url: data.dl }
      throw new Error('SiputZX video falló')
    }
  },
  {
    name: 'Agatz',
    download: async (url) => {
      const res = await fetch(`https://api.agatz.xyz/api/ytmp4?url=${url}`)
      const data = await res.json()
      if (data?.data?.downloadUrl) return { url: data.data.downloadUrl }
      throw new Error('Agatz video falló')
    }
  },
  {
    name: 'ZenKey',
    download: async (url) => {
      const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp4?apikey=zenkey&url=${url}`)
      const { result } = await res.json()
      if (result?.download?.url) return { url: result.download.url }
      throw new Error('ZenKey video falló')
    }
  },
  {
    name: 'Axeel',
    download: async (url) => {
      const res = await fetch(`https://axeel.my.id/api/download/video?url=${url}`)
      const json = await res.json()
      if (json?.downloads?.url) return { url: json.downloads.url }
      throw new Error('Axeel falló')
    }
  },
  {
    name: 'Y2Mate',
    download: async (url) => {
      const res = await fetch(`https://api-y2mate.com/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format: 'mp4', quality: '720' })
      })
      const data = await res.json()
      if (data?.downloadUrl) return { url: data.downloadUrl }
      throw new Error('Y2Mate video falló')
    }
  },
  {
    name: 'SaveFrom',
    download: async (url) => {
      const res = await fetch(`https://api.savefrom.net/download?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      const videoUrl = data?.url?.find(item => item.type === 'video' && item.quality === '720p')?.url
      if (videoUrl) return { url: videoUrl }
      throw new Error('SaveFrom video falló')
    }
  },
  {
    name: 'Loader',
    download: async (url) => {
      const res = await fetch(`https://loader.to/ajax/download.php?format=720&url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (data?.download?.url) return { url: data.download.url }
      throw new Error('Loader video falló')
    }
  },
  {
    name: 'SnapSave',
    download: async (url) => {
      const res = await fetch('https://snapsave.app/action.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}`
      })
      const data = await res.json()
      const video720 = data?.table?.find(item => item.quality === '720p')
      if (video720?.url) return { url: video720.url }
      throw new Error('SnapSave video falló')
    }
  },
  {
    name: 'YTMate',
    download: async (url) => {
      const res = await fetch(`https://ytmate.app/api/convert?url=${encodeURIComponent(url)}&format=mp4`)
      const data = await res.json()
      if (data?.downloadUrl) return { url: data.downloadUrl }
      throw new Error('YTMate video falló')
    }
  },
  {
    name: 'YT5s',
    download: async (url) => {
      const res = await fetch(`https://yt5s.com/api/ajaxConvert/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}&ftype=mp4&fquality=720`
      })
      const data = await res.json()
      if (data?.dlink) return { url: data.dlink }
      throw new Error('YT5s video falló')
    }
  },
  {
    name: 'X2Download',
    download: async (url) => {
      const res = await fetch(`https://x2download.app/api/ajaxConvert`, {
        method: 'POST',
        body: new URLSearchParams({ url, format: 'mp4', quality: '720' })
      })
      const data = await res.json()
      if (data?.dlink) return { url: data.dlink }
      throw new Error('X2Download video falló')
    }
  },
  {
    name: 'YT1s',
    download: async (url) => {
      const res = await fetch(`https://yt1s.com/api/ajaxConvert/convert`, {
        method: 'POST',
        body: new URLSearchParams({ url, ftype: 'mp4', fquality: '720' })
      })
      const data = await res.json()
      if (data?.dlink) return { url: data.dlink }
      throw new Error('YT1s video falló')
    }
  },
  {
    name: 'YouTubeMP4',
    download: async (url) => {
      const res = await fetch(`https://www.yt-download.org/api/button/videos/${encodeURIComponent(url)}`)
      const data = await res.json()
      const video720 = data?.videos?.find(v => v.quality === '720p')
      if (video720?.url) return { url: video720.url }
      throw new Error('YouTubeMP4 falló')
    }
  },
  {
    name: 'YTDL-MP4',
    download: async (url) => {
      const result = await ytMp4(url)
      return { url: result.result, title: result.title, thumb: result.thumb }
    }
  }
]

// 🔄 Sistema de descarga con fallback automático
async function downloadWithFallback(url, apis, quality = null) {
  const errors = []
  
  for (const api of apis) {
    try {
      console.log(`🔄 Intentando con API: ${api.name}`)
      
      const downloadPromise = quality 
        ? api.download(url, quality)
        : api.download(url)
      
      const result = await Promise.race([
        downloadPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
        )
      ])
      
      if (result?.url) {
        console.log(`✅ Descarga exitosa con: ${api.name}`)
        return { ...result, apiUsed: api.name }
      }
    } catch (err) {
      console.log(`⚠️ API ${api.name} falló: ${err.message}`)
      errors.push(`${api.name}: ${err.message}`)
      continue
    }
  }
  
  throw new Error(`Todas las APIs fallaron:\n${errors.slice(0, 3).join('\n')}`)
}

// 📋 Obtener información del video
async function getVideoInfo(url) {
  try {
    // Intentar con yts primero
    const search = await yts(url)
    if (search?.videos?.[0]) {
      const video = search.videos[0]
      return {
        title: video.title,
        author: video.author.name,
        duration: video.timestamp,
        views: formatNumber(video.views),
        thumbnail: video.thumbnail,
        url: video.url,
        ago: video.ago
      }
    }
  } catch (err) {
    console.log('⚠️ yts falló, intentando con ytdl-core')
  }

  try {
    // Fallback con ytdl-core
    const info = await ytdl.getInfo(url)
    return {
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      duration: formatDuration(info.videoDetails.lengthSeconds),
      views: formatNumber(info.videoDetails.viewCount),
      thumbnail: info.videoDetails.thumbnails[0]?.url,
      url: info.videoDetails.video_url
    }
  } catch (err) {
    console.log('⚠️ ytdl-core también falló')
    return null
  }
}

// 🎯 Handler principal
const handler = async (m, { conn, text, args, usedPrefix, command }) => {
  if (!args[0]) {
    return m.reply(
      `*🎵 ¿Qué deseas descargar?*\n\n` +
      `💡 *Uso correcto:*\n` +
      `• ${usedPrefix + command} https://youtu.be/ejemplo\n` +
      `• ${usedPrefix + command} 1 (del último resultado de búsqueda)\n\n` +
      `_Ingresa el enlace de YouTube o el número de la lista_`
    )
  }

  const sendType = command.includes('doc') ? 'document' : 
                   command.includes('mp3') ? 'audio' : 'video'
  
  const isAudio = command.includes('mp3')
  const isVideo = command.includes('mp4')

  // Verificar si hay una solicitud en progreso
  if (userRequests[m.sender]) {
    return m.reply('⏳ *Espera...* Ya tienes una descarga en proceso. Por favor, espera a que termine.')
  }

  userRequests[m.sender] = true

  try {
    // 🔍 Obtener URL de YouTube
    let youtubeLink = args[0]
    
    // Si es un número, buscar en la lista global
    if (!args[0].includes('you') && !isNaN(parseInt(args[0]))) {
      const index = parseInt(args[0]) - 1
      if (index >= 0 && Array.isArray(global.videoList)) {
        const matchingItem = global.videoList.find(item => item.from === m.sender)
        if (matchingItem && matchingItem.urls[index]) {
          youtubeLink = matchingItem.urls[index]
        } else {
          delete userRequests[m.sender]
          return m.reply(`⚠️ No se encontró un enlace para ese número. Ingresa un número entre 1 y ${matchingItem?.urls?.length || 0}`)
        }
      }
    }

    // Validar URL de YouTube
    if (!youtubeLink.match(/youtu\.?be/)) {
      delete userRequests[m.sender]
      return m.reply('❌ Por favor, proporciona un enlace válido de YouTube')
    }

    // 📋 Obtener información del video
    m.react('🔍')
    const videoInfo = await getVideoInfo(youtubeLink)

    // 📥 DESCARGAR AUDIO MP3
    if (isAudio) {
      const loadingMsg = await m.reply(
        `╭━━━『 *DESCARGANDO AUDIO* 』━━━╮\n` +
        `│\n` +
        `│ 🎵 *Título:* ${videoInfo?.title || 'Obteniendo...'}\n` +
        `│ 👤 *Canal:* ${videoInfo?.author || 'Desconocido'}\n` +
        `│ ⏱️ *Duración:* ${videoInfo?.duration || 'N/A'}\n` +
        `│\n` +
        `│ ⬇️ Descargando MP3...\n` +
        `│ _Esto puede tardar unos segundos_\n` +
        `│\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
      )

      try {
        const result = await downloadWithFallback(youtubeLink, AudioAPIs)
        
        await conn.sendMessage(m.chat, {
          [sendType]: { url: result.url },
          mimetype: 'audio/mpeg',
          fileName: `${sanitizeFilename(result.title || videoInfo?.title || 'audio')}.mp3`,
          contextInfo: {
            externalAdReply: {
              title: result.title || videoInfo?.title || 'Audio descargado',
              body: `${videoInfo?.author || 'YouTube'} • Descargado con ${result.apiUsed}`,
              thumbnailUrl: videoInfo?.thumbnail || 'https://i.ibb.co/ZKKSZHT/Picsart-23-06-24-13-36-01-843.jpg',
              sourceUrl: youtubeLink,
              mediaType: 2
            }
          }
        }, { quoted: m })

        m.react('✅')
      } catch (error) {
        throw new Error(`Error al descargar audio: ${error.message}`)
      }
    }

    // 📹 DESCARGAR VIDEO MP4
    if (isVideo) {
      const loadingMsg = await m.reply(
        `╭━━━『 *DESCARGANDO VIDEO* 』━━━╮\n` +
        `│\n` +
        `│ 🎬 *Título:* ${videoInfo?.title || 'Obteniendo...'}\n` +
        `│ 👤 *Canal:* ${videoInfo?.author || 'Desconocido'}\n` +
        `│ ⏱️ *Duración:* ${videoInfo?.duration || 'N/A'}\n` +
        `│ 👁️ *Vistas:* ${videoInfo?.views || 'N/A'}\n` +
        `│\n` +
        `│ ⬇️ Descargando MP4...\n` +
        `│ _Esto puede tardar un poco más_\n` +
        `│\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
      )

      try {
        const quality = args[1] || '720'
        const result = await downloadWithFallback(youtubeLink, VideoAPIs, quality)

        await conn.sendMessage(m.chat, {
          [sendType]: { url: result.url },
          mimetype: 'video/mp4',
          fileName: `${sanitizeFilename(result.title || videoInfo?.title || 'video')}.mp4`,
          caption: 
            `╭━━━━━━━━━━━━━━━━━━╮\n` +
            `│ 🎬 *${result.title || videoInfo?.title || 'Video'}*\n` +
            `│\n` +
            `│ 👤 *Canal:* ${videoInfo?.author || 'Desconocido'}\n` +
            `│ ⏱️ *Duración:* ${videoInfo?.duration || 'N/A'}\n` +
            `│ 👁️ *Vistas:* ${videoInfo?.views || 'N/A'}\n` +
            `│ ⚙️ *API:* ${result.apiUsed}\n` +
            `│\n` +
            `╰━━━━━━━━━━━━━━━━━━╯`,
          thumbnail: result.thumb || videoInfo?.thumbnail
        }, { quoted: m })

        m.react('✅')
      } catch (error) {
        throw new Error(`Error al descargar video: ${error.message}`)
      }
    }

  } catch (error) {
    console.error('❌ Error crítico:', error)
    m.reply(
      `🚫 *Error en la descarga*\n\n` +
      `📋 *Detalles:* ${error.message}\n\n` +
      `💡 *Soluciones:*\n` +
      `• Verifica que el enlace de YouTube sea válido\n` +
      `• Intenta con otro video\n` +
      `• El video puede estar restringido o no disponible\n` +
      `• Usa el comando *${usedPrefix}yts* para buscar primero\n\n` +
      `_Si el problema persiste, contacta al desarrollador_`
    )
    m.react('❌')
  } finally {
    delete userRequests[m.sender]
  }
}

// ⚙️ Funciones auxiliares
function formatNumber(n) {
  if (!n) return '0'
  const num = parseInt(n.toString().replace(/\D/g, ''))
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toLocaleString('es-ES')
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, '-').substring(0, 180)
}

function bytesToSize(bytes) {
  return new Promise((resolve) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return resolve('n/a')
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10)
    if (i === 0) resolve(`${bytes} ${sizes[i]}`)
    resolve(`${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`)
  })
}

async function ytMp3(url) {
  return new Promise((resolve, reject) => {
    ytdl.getInfo(url).then(async (getUrl) => {
      let result = []
      for (let i = 0; i < getUrl.formats.length; i++) {
        let item = getUrl.formats[i]
        if (item.mimeType === 'audio/webm; codecs="opus"') {
          let { contentLength } = item
          let bytes = await bytesToSize(contentLength)
          result[i] = { audio: item.url, size: bytes }
        }
      }
      let resultFix = result.filter(x => x.audio && x.size)
      if (!resultFix[0]) return reject(new Error('No se encontró formato de audio'))
      let tiny = await axios.get(`https://tinyurl.com/api-create.php?url=${resultFix[0].audio}`)
      let tinyUrl = tiny.data
      let title = getUrl.videoDetails.title
      let thumb = getUrl.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url
      resolve({ title, result: tinyUrl, result2: resultFix, thumb })
    }).catch(reject)
  })
}

async function ytMp4(url) {
  return new Promise(async (resolve, reject) => {
    ytdl.getInfo(url).then(async (getUrl) => {
      let result = []
      for (let i = 0; i < getUrl.formats.length; i++) {
        let item = getUrl.formats[i]
        if (item.container === 'mp4' && item.hasVideo === true && item.hasAudio === true) {
          let { qualityLabel, contentLength } = item
          let bytes = await bytesToSize(contentLength)
          result[i] = { video: item.url, quality: qualityLabel, size: bytes }
        }
      }
      let resultFix = result.filter(x => x.video && x.size && x.quality)
      if (!resultFix[0]) return reject(new Error('No se encontró formato de video'))
      let tiny = await axios.get(`https://tinyurl.com/api-create.php?url=${resultFix[0].video}`)
      let tinyUrl = tiny.data
      let title = getUrl.videoDetails.title
      let thumb = getUrl.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url
      resolve({ title, result: tinyUrl, result2: resultFix[0].video, thumb })
    }).catch(reject)
  })
}

async function ytPlay(query) {
  return new Promise((resolve, reject) => {
    yts(query).then(async (getData) => {
      let result = getData.videos.slice(0, 5)
      if (!result.length) return reject(new Error('No se encontraron resultados'))
      let url = []
      for (let i = 0; i < result.length; i++) {
        url.push(result[i].url)
      }
      let random = url[0]
      let getAudio = await ytMp3(random)
      resolve(getAudio)
    }).catch(reject)
  })
}

async function ytPlayVid(query) {
  return new Promise((resolve, reject) => {
    yts(query).then(async (getData) => {
      let result = getData.videos.slice(0, 5)
      if (!result.length) return reject(new Error('No se encontraron resultados'))
      let url = []
      for (let i = 0; i < result.length; i++) {
        url.push(result[i].url)
      }
      let random = url[0]
      let getVideo = await ytMp4(random)
      resolve(getVideo)
    }).catch(reject)
  })
}

// 📝 Configuración del comando
handler.help = ['ytmp3 <url>', 'ytmp4 <url>']
handler.tags = ['downloader']
handler.command = /^(ytmp3|ytmp4|fgmp4|fgmp3|dlmp3|ytmp4doc|ytmp3doc)$/i
handler.limit = false

export default handler