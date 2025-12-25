import fetch from 'node-fetch'

/* ======================== CONFIG ======================== */
const CONFIG = {
  API_BASE: 'https://api-nv.ultraplus.click/api/dl/facebook',
  API_KEY: 'RrSyVm056GfAhjuM',

  MAX_FILE_SIZE: 200 * 1024 * 1024,
  RATE_LIMIT_WINDOW: 60_000,
  MAX_REQUESTS_PER_WINDOW: 5
}

/* ======================== STATE ======================== */
const activeDownloads = new Set()
const rateLimitMap = new Map()

/* ======================== UTILS ======================== */
function isValidFacebookUrl(url) {
  return /(?:facebook\.com|fb\.watch)/i.test(url)
}

function formatFileSize(bytes) {
  if (!bytes) return 'Desconocido'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return `${bytes.toFixed(2)} ${units[i]}`
}

function checkRateLimit(userId) {
  const now = Date.now()
  const user = rateLimitMap.get(userId)

  if (!user || now > user.reset) {
    rateLimitMap.set(userId, {
      count: 1,
      reset: now + CONFIG.RATE_LIMIT_WINDOW
    })
    return
  }

  if (user.count >= CONFIG.MAX_REQUESTS_PER_WINDOW) {
    throw new Error('⏳ Demasiadas solicitudes, espera un momento')
  }

  user.count++
}

/* ======================== FETCH MEDIA ======================== */
async function fetchFacebookMedia(url) {
  const u = new URL(CONFIG.API_BASE)
  u.search = new URLSearchParams({
    url,
    key: CONFIG.API_KEY
  })

  const res = await fetch(u.toString(), {
    headers: { 'User-Agent': 'Mozilla/5.0 (Android 10)' }
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const data = await res.json()
  if (!data.status) {
    throw new Error('No se pudo obtener el video')
  }

  const video =
    data.result.video_hd ||
    data.result.video_sd ||
    data.result.url

  if (!video) {
    throw new Error('Video no disponible')
  }

  return {
    title: data.result.title || 'Facebook Video',
    duration: data.result.duration || 'Desconocido',
    thumbnail: data.result.thumbnail,
    url: video
  }
}

/* ======================== DOWNLOAD ======================== */
async function downloadToBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Android 10)' }
  })

  if (!res.ok) {
    throw new Error(`Error descargando: HTTP ${res.status}`)
  }

  const size = parseInt(res.headers.get('content-length') || '0', 10)

  if (size > CONFIG.MAX_FILE_SIZE) {
    throw new Error(`Archivo demasiado grande (${formatFileSize(size)})`)
  }

  const chunks = []
  for await (const chunk of res.body) chunks.push(chunk)

  return {
    buffer: Buffer.concat(chunks),
    size
  }
}

/* ======================== HANDLER ======================== */
const handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    if (!args[0]) {
      return m.reply(
        `❌ Uso incorrecto\n\nEjemplo:\n${usedPrefix + command} https://fb.watch/...`
      )
    }

    const url = args[0].trim()

    if (!isValidFacebookUrl(url)) {
      return m.reply('⚠️ El enlace no es válido de Facebook')
    }

    checkRateLimit(m.sender)

    if (activeDownloads.has(m.sender)) {
      return m.reply('⏳ Ya tienes una descarga en progreso')
    }

    activeDownloads.add(m.sender)
    await m.react('🔍')

    const waitMsg = await m.reply('🔎 Buscando video en Facebook...')

    const media = await fetchFacebookMedia(url)

    await conn.sendMessage(m.chat, {
      text:
        `📥 Descargando...\n\n` +
        `📌 ${media.title}\n` +
        `⏱️ ${media.duration}s`,
      edit: waitMsg.key
    })

    const { buffer, size } = await downloadToBuffer(media.url)

    await conn.sendMessage(m.chat, {
      video: buffer,
      mimetype: 'video/mp4',
      fileName: `facebook_${Date.now()}.mp4`,
      caption:
        `╔══════════════════╗\n` +
        `║  ✅ DESCARGA LISTA  ║\n` +
        `╚══════════════════╝\n\n` +
        `📹 ${media.title}\n` +
        `💾 ${formatFileSize(size)}`
    }, { quoted: m })

    await conn.sendMessage(m.chat, { delete: waitMsg.key })
    await m.react('✅')

  } catch (e) {
    await m.reply(`❌ Error:\n${e.message}`)
    await m.react('❌')
  } finally {
    activeDownloads.delete(m.sender)
  }
}

/* ======================== METADATA ======================== */
handler.help = ['facebook <url>']
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbdl)$/i
handler.limit = 1
handler.register = true

export default handler