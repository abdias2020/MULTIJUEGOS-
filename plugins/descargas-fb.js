import fg from 'api-dylux'
import fetch from 'node-fetch'
import axios from 'axios'

/* ======================== CONFIGURACIÓN ======================== */
const CONFIG = {
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
  CACHE_TTL: 10 * 60 * 1000,
  FETCH_TIMEOUT: 30_000,
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,
  RATE_LIMIT_WINDOW: 60_000,
  MAX_REQUESTS_PER_WINDOW: 5
}

/* ======================== ESTADO RUNTIME ======================== */
const activeDownloads = new Set()
const cache = new Map()
const rateLimitMap = new Map()

/* ======================== UTILIDADES ======================== */

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT)
  
  try {
    const response = await fetch(url, { 
      ...opts, 
      signal: controller.signal 
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Timeout: La petición tardó demasiado')
    }
    throw error
  }
}

async function safeFetchJson(url, opts = {}) {
  const response = await fetchWithTimeout(url, {
    ...opts,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'es-ES,es;q=0.9',
      ...(opts.headers || {})
    }
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  const text = await response.text()

  if (!contentType.includes('application/json') && !/^\s*[\{\[]/.test(text)) {
    throw new Error('API devolvió HTML en lugar de JSON')
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    console.error('Error parsing JSON:', text.substring(0, 200))
    throw new Error('JSON inválido desde la API')
  }
}

async function downloadToBuffer(url, onProgress = null) {
  console.log('Descargando archivo...')
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
      'Accept': '*/*'
    }
  })

  if (!response.ok) {
    throw new Error(`Error descargando: HTTP ${response.status}`)
  }

  const totalSize = parseInt(response.headers.get('content-length') || '0', 10)
  
  if (totalSize === 0) {
    // Si no sabemos el tamaño, descargar directamente
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  // Descarga con progreso
  const chunks = []
  let downloadedSize = 0
  let lastProgress = 0

  for await (const chunk of response.body) {
    chunks.push(chunk)
    downloadedSize += chunk.length
    
    const progress = Math.floor((downloadedSize / totalSize) * 100)
    
    // Actualizar cada 10%
    if (progress >= lastProgress + 10) {
      lastProgress = progress
      if (onProgress) {
        await onProgress(progress, downloadedSize, totalSize)
      }
      console.log(`Descarga: ${progress}% (${(downloadedSize / (1024 * 1024)).toFixed(2)} MB)`)
    }
  }

  const buffer = Buffer.concat(chunks)
  console.log(`Descarga completa: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`)
  return buffer
}

async function getRemoteFileSize(url) {
  try {
    const headResponse = await fetchWithTimeout(url, {
      method: 'HEAD',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' 
      }
    })
    
    const contentLength = headResponse.headers.get('content-length')
    if (contentLength) {
      return parseInt(contentLength, 10)
    }

    const rangeResponse = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
        'Range': 'bytes=0-0'
      }
    })

    const contentRange = rangeResponse.headers.get('content-range')
    if (contentRange && contentRange.includes('/')) {
      const totalSize = contentRange.split('/')[1]
      return parseInt(totalSize, 10)
    }

    const length = rangeResponse.headers.get('content-length')
    if (length) return parseInt(length, 10)

  } catch (error) {
    console.warn('No se pudo obtener tamaño del archivo:', error.message)
  }
  
  return null
}

async function retryWithBackoff(fn, maxRetries = CONFIG.MAX_RETRIES) {
  let lastError = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      const noRetryErrors = ['HTML', 'temporalmente no disponible', 'blocked', 'banned']
      const shouldSkipRetry = noRetryErrors.some(msg => 
        error.message.toLowerCase().includes(msg.toLowerCase())
      )
      
      if (shouldSkipRetry) {
        throw error
      }
      
      if (attempt < maxRetries) {
        const delay = CONFIG.RETRY_DELAY * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

function isValidFacebookUrl(url) {
  const fbRegex = /(?:https?:\/\/)?(?:www\.|m\.|web\.|l\.)?(?:facebook\.com|fb\.watch|fb\.me)\/(?:watch\/?\?v=|videos?\/|reel\/|share\/|story\.php|photo\.php|permalink\.php|groups\/[\w\.]+\/permalink\/)?[\w\-\.]+\/?/gi
  return fbRegex.test(url)
}

function checkRateLimit(userId) {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + CONFIG.RATE_LIMIT_WINDOW
    })
    return true
  }

  if (userLimit.count >= CONFIG.MAX_REQUESTS_PER_WINDOW) {
    const timeLeft = Math.ceil((userLimit.resetTime - now) / 1000)
    throw new Error(`Límite de descargas alcanzado. Espera ${timeLeft}s`)
  }

  userLimit.count++
  return true
}

function cleanCache() {
  const now = Date.now()
  for (const [key, value] of cache.entries()) {
    if (now - value.ts > CONFIG.CACHE_TTL) {
      cache.delete(key)
    }
  }
}

/* ======================== PROVEEDORES ======================== */

async function providerApiDylux(url) {
  try {
    const result = await fg.fbdl(url)
    
    const videoUrl = result?.data?.[0]?.url || 
                     result?.url || 
                     result?.result?.[0]?.url ||
                     result?.videoUrl
    
    if (!videoUrl) {
      throw new Error('Sin URL de video')
    }
    
    return { 
      type: 'video', 
      url: videoUrl,
      title: result?.title || 'Facebook Video',
      thumbnail: result?.thumbnail
    }
  } catch (error) {
    throw new Error(`api-dylux: ${error.message}`)
  }
}

async function providerDorratz(url) {
  try {
    const apiUrl = 'https://api.dorratz.com/fbvideo'
    
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ url: url })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    
    const videoUrl = data?.result?.hd || 
                     data?.result?.sd || 
                     data?.download || 
                     data?.url ||
                     data?.data?.url
    
    if (!videoUrl) {
      throw new Error('Sin resultados')
    }
    
    return { 
      type: 'video', 
      url: videoUrl,
      quality: data?.result?.hd ? 'HD' : 'SD',
      title: data?.result?.title || data?.title
    }
  } catch (error) {
    throw new Error(`Dorratz: ${error.message}`)
  }
}

async function providerRyzumi(url) {
  try {
    const apiUrl = `https://api.ryzumi.vip/api/downloader/fbdl?url=${encodeURIComponent(url)}`
    const data = await safeFetchJson(apiUrl)
    
    if (!data?.success || data?.status !== 'success') {
      throw new Error('Respuesta inválida')
    }
    
    const videoUrl = data?.result?.hd || 
                     data?.result?.sd || 
                     data?.data?.hd ||
                     data?.data?.sd ||
                     data?.url
    
    if (!videoUrl) {
      throw new Error('Sin URL de video')
    }
    
    return { 
      type: 'video', 
      url: videoUrl,
      quality: (data?.result?.hd || data?.data?.hd) ? 'HD' : 'SD',
      title: data?.result?.title || data?.data?.title
    }
  } catch (error) {
    throw new Error(`Ryzumi: ${error.message}`)
  }
}

/* ======================== LÓGICA PRINCIPAL ======================== */

async function tryProviders(url) {
  if (Math.random() < 0.1) cleanCache()
  
  const cached = cache.get(url)
  if (cached && (Date.now() - cached.ts) < CONFIG.CACHE_TTL) {
    console.log('Resultado desde caché')
    return cached.result
  }

  const providers = [
    { fn: providerApiDylux, name: 'api-dylux' },
    { fn: providerDorratz, name: 'Dorratz' },
    { fn: providerRyzumi, name: 'Ryzumi' }
  ]

  const errors = []
  
  for (const provider of providers) {
    try {
      console.log(`Intentando con ${provider.name}...`)
      
      const result = await retryWithBackoff(async () => {
        return await provider.fn(url)
      })
      
      if (result && result.url) {
        console.log(`Éxito con ${provider.name}`)
        cache.set(url, { result, ts: Date.now() })
        return result
      }
    } catch (error) {
      const errorMsg = `${provider.name}: ${error.message}`
      console.log(`Falló: ${errorMsg}`)
      errors.push(errorMsg)
      continue
    }
  }

  throw new Error(`Todos los proveedores fallaron`)
}

function formatFileSize(bytes) {
  if (!bytes) return 'Desconocido'
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}

function generateResultMessage(media, size) {
  let message = `Descarga exitosa\n\n`
  message += `Tipo: ${media.type === 'video' ? 'Video' : 'Imagen'}\n`
  
  if (media.title) {
    message += `Título: ${media.title}\n`
  }
  
  if (media.quality) {
    message += `Calidad: ${media.quality}\n`
  }
  
  if (size) {
    message += `Tamaño: ${formatFileSize(size)}\n`
  }
  
  return message
}

/* ======================== HANDLER PRINCIPAL ======================== */

const handler = async (m, { conn, args, command, usedPrefix }) => {
  let progressMsg = null
  
  try {
    if (!args[0]) {
      return m.reply(
        `Uso incorrecto\n\n` +
        `Debes proporcionar un enlace de Facebook.\n\n` +
        `Ejemplo:\n${usedPrefix + command} https://www.facebook.com/watch?v=123456`
      )
    }

    const url = args[0].trim()

    if (!isValidFacebookUrl(url)) {
      return m.reply(
        `URL inválida\n\n` +
        `El enlace debe ser de Facebook o fb.watch.\n` +
        `Asegúrate de que el video sea público.`
      )
    }

    try {
      checkRateLimit(m.sender)
    } catch (error) {
      return conn.reply(m.chat, error.message, m, { mentions: [m.sender] })
    }

    if (activeDownloads.has(m.sender)) {
      return conn.reply(
        m.chat,
        `@${m.sender.split('@')[0]}, ya tienes una descarga en progreso.`,
        m,
        { mentions: [m.sender] }
      )
    }

    activeDownloads.add(m.sender)
    await m.react('⏳')

    // Mensaje inicial
    const waitMsg = await conn.reply(
      m.chat,
      `Buscando video en Facebook...`,
      m
    )

    let media = null
    
    try {
      media = await tryProviders(url)
      console.log('Media obtenida:', { type: media.type, url: media.url.substring(0, 80) })
    } catch (error) {
      console.error('Error en tryProviders:', error)
      throw new Error(
        `No se pudo obtener el contenido.\n\n` +
        `Posibles causas:\n` +
        `• El video no es público\n` +
        `• El enlace ha expirado\n` +
        `• Facebook está bloqueando las descargas`
      )
    }

    if (!media.url || !media.url.startsWith('http')) {
      throw new Error('URL de descarga inválida')
    }

    const fileSize = await getRemoteFileSize(media.url)
    
    if (fileSize && fileSize > CONFIG.MAX_FILE_SIZE) {
      const sizeMB = formatFileSize(fileSize)
      const maxSizeMB = formatFileSize(CONFIG.MAX_FILE_SIZE)
      
      await conn.sendMessage(m.chat, { delete: waitMsg.key })
      await conn.reply(
        m.chat,
        `Archivo muy grande\n\n` +
        `Tamaño: ${sizeMB}\n` +
        `Límite: ${maxSizeMB}\n\n` +
        `Enlace directo:\n${media.url}`,
        m
      )
      
      await m.react('⚠️')
      return
    }

    const fileName = media.type === 'video' 
      ? `facebook_${Date.now()}.mp4` 
      : `facebook_${Date.now()}.jpg`
    
    // Actualizar mensaje: Descargando
    await conn.sendMessage(m.chat, {
      text: `Descargando video...\nTamaño: ${formatFileSize(fileSize)}`,
      edit: waitMsg.key
    })

    // Descargar con callback de progreso
    let lastProgressUpdate = 0
    const buffer = await downloadToBuffer(media.url, async (progress, downloaded, total) => {
      const now = Date.now()
      // Actualizar mensaje cada 2 segundos
      if (now - lastProgressUpdate > 2000) {
        lastProgressUpdate = now
        try {
          await conn.sendMessage(m.chat, {
            text: `Descargando video...\n\nProgreso: ${progress}%\n${formatFileSize(downloaded)} / ${formatFileSize(total)}`,
            edit: waitMsg.key
          })
        } catch (e) {
          // Ignorar errores de edición
        }
      }
    })

    // Actualizar mensaje: Enviando
    await conn.sendMessage(m.chat, {
      text: `Enviando tu video...\n\nEspera un momento...`,
      edit: waitMsg.key
    })

    const caption = generateResultMessage(media, fileSize)

    // Enviar video
    if (media.type === 'video') {
      await conn.sendMessage(m.chat, {
        video: buffer,
        caption: caption,
        fileName: fileName,
        mimetype: 'video/mp4'
      }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, {
        image: buffer,
        caption: caption,
        fileName: fileName
      }, { quoted: m })
    }

    console.log('Archivo enviado exitosamente')
    await m.react('✅')
    
    // Eliminar mensaje de progreso
    try {
      await conn.sendMessage(m.chat, { delete: waitMsg.key })
    } catch (e) {
      // Ignorar
    }

  } catch (error) {
    console.error('Handler error:', error)
    
    await m.reply(
      `Error en la descarga\n\n` +
      `${error.message}\n\n` +
      `Sugerencias:\n` +
      `• Verifica que el enlace sea correcto\n` +
      `• Asegúrate de que el video sea público\n` +
      `• Intenta con otro video`
    )
    
    await m.react('❌')
  } finally {
    activeDownloads.delete(m.sender)
  }
}

/* ======================== METADATA ======================== */

handler.help = ['fb', 'facebook', 'fbdl'].map(v => v + ' <url>')
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbdl|facebookdl|facebook2|fb2|facebookdl2|fbdl2|facebook3|fb3|fbdown|fbdownload)$/i
handler.register = true
handler.limit = 1

export default handler