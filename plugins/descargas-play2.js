// 🎧 Sistema de descarga YouTube mejorado - ytmp3/ytmp4
import fetch from 'node-fetch'
import yts from 'yt-search'
import ytdl from 'ytdl-core'
import axios from 'axios'
import { savetube } from '../lib/yt-savetube.js'
import { ogmp3 } from '../lib/youtubedl.js'
import { amdl, ytdown } from '../lib/scraper.js'

const userRequests = {}
const TIMEOUT = 30000 // 30 segundos timeout

// 📦 Sistema de APIs organizado por tipo
const AudioAPIs = [
  {
    name: 'SaveTube',
    download: async (url) => {
      const result = await savetube.download(url, 'mp3')
      return { url: result.result.download, title: result.result.title }
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
      return { url: data.dl }
    }
  },
  {
    name: 'Agatz',
    download: async (url) => {
      const res = await fetch(`https://api.agatz.xyz/api/ytmp3?url=${url}`)
      const data = await res.json()
      return { url: data.data.downloadUrl }
    }
  },
  {
    name: 'ZenKey',
    download: async (url) => {
      const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp3?apikey=zenkey&url=${url}`)
      const { result } = await res.json()
      return { url: result.download.url }
    }
  },
  {
    name: 'YTDL-Core',
    download: async (url) => {
      const searchh = await yts(url)
      const __res = searchh.all.map(v => v).filter(v => v.type === "video")
      const infoo = await ytdl.getInfo('https://youtu.be/' + __res[0].videoId)
      const ress = await ytdl.chooseFormat(infoo.formats, { filter: 'audioonly' })
      return { url: ress.url, title: __res[0].title }
    }
  }
]

const VideoAPIs = [
  {
    name: 'SaveTube',
    download: async (url) => {
      const result = await savetube.download(url, '720')
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
      return { url: res.result.download }
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
      return { url: data.dl }
    }
  },
  {
    name: 'Agatz',
    download: async (url) => {
      const res = await fetch(`https://api.agatz.xyz/api/ytmp4?url=${url}`)
      const data = await res.json()
      return { url: data.data.downloadUrl }
    }
  },
  {
    name: 'ZenKey',
    download: async (url) => {
      const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp4?apikey=zenkey&url=${url}`)
      const { result } = await res.json()
      return { url: result.download.url }
    }
  },
  {
    name: 'Axeel',
    download: async (url) => {
      const res = await fetch(`https://axeel.my.id/api/download/video?url=${url}`)
      const json = await res.json()
      if (json?.downloads?.url) {
        return { url: json.downloads.url }
      }
      throw new Error('No download URL')
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

// 🎯 Handler principal
const handler = async (m, { conn, text, args, usedPrefix, command }) => {
  if (!args[0]) {
    return m.reply(
      `*🎵 ¿Qué deseas descargar?*\n\n` +
      `💡 Uso correcto:\n` +
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

    // 📥 DESCARGAR AUDIO MP3
    if (isAudio) {
      m.reply([
        '*⌛ Procesando tu audio... Espera un momento 🎵*',
        '*🎧 Descargando MP3, por favor espera...*',
        '*⏳ Obteniendo tu canción desde YouTube 🎶*'
      ].getRandom())

      try {
        const result = await downloadWithFallback(youtubeLink, AudioAPIs)
        
        await conn.sendMessage(m.chat, {
          [sendType]: { url: result.url },
          mimetype: 'audio/mpeg',
          fileName: `${result.title || 'audio'}.mp3`,
          contextInfo: {
            externalAdReply: {
              title: result.title || 'Audio descargado',
              body: `Descargado con ${result.apiUsed}`,
              thumbnailUrl: result.thumb || 'https://i.ibb.co/ZKKSZHT/Picsart-23-06-24-13-36-01-843.jpg',
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
      m.reply([
        '*⌛ Descargando tu video... Espera un momento 📹*',
        '*🎬 Procesando MP4, por favor aguarda...*',
        '*⏳ Obteniendo tu video desde YouTube 🎥*'
      ].getRandom())

      try {
        const quality = args[1] || '720'
        const result = await downloadWithFallback(youtubeLink, VideoAPIs, quality)
        
        // Obtener información del video si no viene en el resultado
        let videoInfo = {}
        if (!result.title) {
          const search = await yts(youtubeLink)
          videoInfo = search.videos[0] || {}
        }

        await conn.sendMessage(m.chat, {
          [sendType]: { url: result.url },
          mimetype: 'video/mp4',
          fileName: `${result.title || videoInfo.title || 'video'}.mp4`,
          caption: `🔰 *Aquí está tu video*\n🔥 *Título:* ${result.title || videoInfo.title || 'Video'}\n⚙️ *Descargado con:* ${result.apiUsed}`,
          thumbnail: result.thumb || videoInfo.thumbnail
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
      `• El video puede estar restringido o no disponible\n\n` +
      `_Si el problema persiste, contacta al desarrollador_`
    )
    m.react('❌')
  } finally {
    delete userRequests[m.sender]
  }
}

// ⚙️ Funciones auxiliares mejoradas
function bytesToSize(bytes) {
  return new Promise((resolve, reject) => {
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
      let resultFix = result.filter(x => x.audio != undefined && x.size != undefined)
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
      let resultFix = result.filter(x => x.video != undefined && x.size != undefined && x.quality != undefined)
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
handler.help = ['ytmp3', 'ytmp4', 'fgmp3', 'fgmp4']
handler.tags = ['downloader']
handler.command = /^(ytmp3|ytmp4|fgmp4|fgmp3|dlmp3|ytmp4doc|ytmp3doc)$/i
handler.limit = false

export default handler