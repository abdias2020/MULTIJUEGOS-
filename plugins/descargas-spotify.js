import axios from 'axios'
import fetch from 'node-fetch'

// ⚙️ APIs principales
const SEARCH_API = 'https://delirius-apiofc.vercel.app/search/spotify'
const DL_API = 'https://delirius-apiofc.vercel.app/download/spotifydl'

// 🧠 Control de peticiones por usuario
const userMessages = new Map()
const userRequests = {}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text)
    return m.reply(
      `🤔 ¿Qué estás buscando?\n\nUsa: *${usedPrefix + command} <nombre o enlace>*\n📌 Ejemplo:\n${usedPrefix + command} TWICE TT`
    )

  if (userRequests[m.sender])
    return conn.reply(
      m.chat,
      `⚠️ Oye @${m.sender.split('@')[0]}, ya tienes una descarga en curso.\n⏳ Espera a que termine antes de pedir otra.`,
      userMessages.get(m.sender) || m
    )

  userRequests[m.sender] = true
  m.react('⌛')

  try {
    const isSpotifyUrl = /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode)\/[A-Za-z0-9]+/i.test(text)
    let trackUrl = text.trim()
    let picked = null

    // 🔍 Si no es enlace, busca la canción
    if (!isSpotifyUrl) {
      const searchUrl = `${SEARCH_API}?q=${encodeURIComponent(text)}`
      console.log('🔍 Buscando:', searchUrl)
      
      const { data: sRes } = await axios.get(searchUrl, { 
        timeout: 25_000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      
      if (!sRes?.status || !Array.isArray(sRes?.data) || sRes.data.length === 0)
        throw new Error('⚠️ No se encontraron resultados para esa búsqueda.')
      
      picked = sRes.data[0]
      trackUrl = picked.url
      console.log('✅ Canción encontrada:', picked.title)
    }

    // 🎧 Intentos de descarga con fallback
    const downloadAttempts = [
      // API 1: Delirius
      async () => {
        const dlUrl = `${DL_API}?url=${encodeURIComponent(trackUrl)}`
        console.log('📥 Intento 1:', dlUrl)
        const { data: dRes } = await axios.get(dlUrl, { 
          timeout: 25_000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        return dRes?.data?.url || null
      },
      // API 2: Siputzx
      async () => {
        const altUrl = `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(trackUrl)}`
        console.log('📥 Intento 2:', altUrl)
        const alt = await fetch(altUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const data = await alt.json()
        return data?.data?.download || null
      },
      // API 3: Backup
      async () => {
        const backupUrl = `https://api.fabdl.com/spotify/get?url=${encodeURIComponent(trackUrl)}`
        console.log('📥 Intento 3:', backupUrl)
        const backup = await fetch(backupUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        const data = await backup.json()
        return data?.result?.download_url || null
      }
    ]

    let downloadUrl = null
    for (const [index, attempt] of downloadAttempts.entries()) {
      try {
        downloadUrl = await attempt()
        if (downloadUrl) {
          console.log(`✅ Descarga exitosa con API ${index + 1}`)
          break
        }
      } catch (err) {
        console.error(`❌ Error en API ${index + 1}:`, err.message)
      }
    }

    if (!downloadUrl) 
      throw new Error('❌ No se pudo obtener la canción desde ninguna API disponible.')

    // 🎵 Información del track
    const {
      title = picked?.title || 'Desconocido',
      artist = picked?.artist || 'Desconocido',
      image = picked?.image || picked?.thumbnail || '',
      duration = picked?.duration || '—:—'
    } = picked || {}

    const info = `🎵 *Título:* ${title}
🎤 *Artista:* ${artist}
⏳ *Duración:* ${duration}
🔗 *Enlace:* ${trackUrl}

> 🚀 *Enviando canción...*`

    const message = await conn.sendMessage(
      m.chat,
      {
        text: info,
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          externalAdReply: {
            showAdAttribution: true,
            renderLargerThumbnail: true,
            title: title,
            body: '🎶 Descargando desde Spotify...',
            mediaType: 1,
            thumbnailUrl: image,
            mediaUrl: trackUrl,
            sourceUrl: trackUrl
          }
        }
      },
      { quoted: m }
    )

    userMessages.set(m.sender, message)

    // 🎧 Envío de audio
    await conn.sendMessage(
      m.chat,
      {
        audio: { url: downloadUrl },
        fileName: `${title}.mp3`,
        mimetype: 'audio/mpeg'
      },
      { quoted: m }
    )

    m.react('✅')
    console.log('✅ Descarga completada:', title)
    
  } catch (error) {
    console.error('❌ Error Spotify:', error.message || error)
    m.react('❌')
    m.reply(`⚠️ Ocurrió un error al procesar tu solicitud.\n\n> ${error.message || error}`)
  } finally {
    delete userRequests[m.sender]
  }
}

handler.help = ['spotify']
handler.tags = ['downloader']
handler.command = /^(spotify|music)$/i
handler.register = true
handler.limit = 1

export default handler