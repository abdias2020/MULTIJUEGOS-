import fg from 'api-dylux'
import fetch from 'node-fetch'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

/* ======================== CONFIGURACIÓN ======================== */
const CONFIG = {
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 200 * 1024 * 1024, // Aumentado a 200MB
  CACHE_TTL: 10 * 60 * 1000,
  FETCH_TIMEOUT: 60_000, // Aumentado a 60 segundos
  MAX_RETRIES: 3, // Más reintentos
  RETRY_DELAY: 1500,
  RATE_LIMIT_WINDOW: 60_000,
  MAX_REQUESTS_PER_WINDOW: 5,
  CHUNK_SIZE: 1024 * 1024 // 1MB chunks para descarga progresiva
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
  console.log('🔽 Iniciando descarga del video...')
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    }
  })

  if (!response.ok) {
    throw new Error(`Error descargando: HTTP ${response.status}`)
  }

  const totalSize = parseInt(response.headers.get('content-length') || '0', 10)
  
  console.log(`📦 Tamaño total del archivo: ${formatFileSize(totalSize)}`)

  const chunks = []
  let downloadedSize = 0
  let lastProgress = -1

  try {
    for await (const chunk of response.body) {
      chunks.push(chunk)
      downloadedSize += chunk.length
      
      if (totalSize > 0) {
        const progress = Math.floor((downloadedSize / totalSize) * 100)
        
        // Actualizar cada 5%
        if (progress >= lastProgress + 5) {
          lastProgress = progress
          if (onProgress) {
            await onProgress(progress, downloadedSize, totalSize)
          }
          console.log(`📥 Descarga: ${progress}% (${formatFileSize(downloadedSize)} / ${formatFileSize(totalSize)})`)
        }
      } else {
        // Sin tamaño conocido, actualizar cada 5MB
        if (Math.floor(downloadedSize / (5 * 1024 * 1024)) > Math.floor((downloadedSize - chunk.length) / (5 * 1024 * 1024))) {
          console.log(`📥 Descargado: ${formatFileSize(downloadedSize)}`)
          if (onProgress) {
            await onProgress(0, downloadedSize, 0)
          }
        }
      }
    }

    const buffer = Buffer.concat(chunks)
    const finalSize = buffer.length
    console.log(`✅ Descarga completa: ${formatFileSize(finalSize)}`)
    
    return { buffer, size: finalSize }
  } catch (error) {
    console.error('❌ Error durante la descarga:', error.message)
    throw new Error(`Error de descarga: ${error.message}`)
  }
}

async function getRemoteFileSize(url) {
  try {
    console.log('📊 Obteniendo tamaño del archivo...')
    
    // Intentar con HEAD primero
    const headResponse = await fetchWithTimeout(url, {
      method: 'HEAD',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' 
      }
    })
    
    const contentLength = headResponse.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength, 10)
      console.log(`📏 Tamaño obtenido (HEAD): ${formatFileSize(size)}`)
      return size
    }

    // Intentar con Range
    const rangeResponse = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
        'Range': 'bytes=0-1023'
      }
    })

    const contentRange = rangeResponse.headers.get('content-range')
    if (contentRange && contentRange.includes('/')) {
      const totalSize = contentRange.split('/')[1]
      if (totalSize !== '*') {
        const size = parseInt(totalSize, 10)
        console.log(`📏 Tamaño obtenido (Range): ${formatFileSize(size)}`)
        return size
      }
    }

    const length = rangeResponse.headers.get('content-length')
    if (length) {
      const size = parseInt(length, 10)
      console.log(`📏 Tamaño obtenido: ${formatFileSize(size)}`)
      return size
    }

  } catch (error) {
    console.warn('⚠️ No se pudo obtener tamaño del archivo:', error.message)
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
        console.log(`🔄 Reintento ${attempt + 1}/${maxRetries} en ${delay}ms...`)
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
    throw new Error(`⏳ Límite de descargas alcanzado. Espera ${timeLeft}s`)
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

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return 'Desconocido'
  
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

function cleanTitle(title) {
  if (!title) return 'Video de Facebook'
  
  // Eliminar caracteres especiales y limitar longitud
  const cleaned = title
    .replace(/[^\w\s\-áéíóúñÁÉÍÓÚÑ]/g, '')
    .trim()
    .substring(0, 100)
  
  return cleaned || 'Video de Facebook'
}

/* ======================== PROVEEDORES ======================== */

async function providerApiDylux(url) {
  try {
    console.log('🔍 Intentando con api-dylux...')
    const result = await fg.fbdl(url)
    
    const videoUrl = result?.data?.[0]?.url || 
                     result?.url || 
                     result?.result?.[0]?.url ||
                     result?.videoUrl
    
    if (!videoUrl) {
      throw new Error('Sin URL de video')
    }
    
    const title = cleanTitle(result?.title || result?.data?.[0]?.title)
    const thumbnail = result?.thumbnail || result?.data?.[0]?.thumbnail
    
    console.log(`✅ api-dylux: Título encontrado: "${title}"`)
    
    return { 
      type: 'video', 
      url: videoUrl,
      title: title,
      thumbnail: thumbnail,
      source: 'api-dylux'
    }
  } catch (error) {
    throw new Error(`api-dylux: ${error.message}`)
  }
}

async function providerDorratz(url) {
  try {
    console.log('🔍 Intentando con Dorratz...')
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
    
    const title = cleanTitle(data?.result?.title || data?.title)
    
    console.log(`✅ Dorratz: Título encontrado: "${title}"`)
    
    return { 
      type: 'video', 
      url: videoUrl,
      quality: data?.result?.hd ? 'HD' : 'SD',
      title: title,
      source: 'Dorratz'
    }
  } catch (error) {
    throw new Error(`Dorratz: ${error.message}`)
  }
}

async function providerRyzumi(url) {
  try {
    console.log('🔍 Intentando con Ryzumi...')
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
    
    const title = cleanTitle(data?.result?.title || data?.data?.title)
    
    console.log(`✅ Ryzumi: Título encontrado: "${title}"`)
    
    return { 
      type: 'video', 
      url: videoUrl,
      quality: (data?.result?.hd || data?.data?.hd) ? 'HD' : 'SD',
      title: title,
      source: 'Ryzumi'
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
    console.log('💾 Resultado desde caché')
    return cached.result
  }

  const providers = [
    { fn: providerDorratz, name: 'Dorratz' },
    { fn: providerApiDylux, name: 'api-dylux' },
    { fn: providerRyzumi, name: 'Ryzumi' }
  ]

  const errors = []
  
  for (const provider of providers) {
    try {
      console.log(`\n🔄 Intentando con ${provider.name}...`)
      
      const result = await retryWithBackoff(async () => {
        return await provider.fn(url)
      })
      
      if (result && result.url) {
        console.log(`✅ Éxito con ${provider.name}`)
        console.log(`📋 Título: ${result.title}`)
        cache.set(url, { result, ts: Date.now() })
        return result
      }
    } catch (error) {
      const errorMsg = `${provider.name}: ${error.message}`
      console.log(`❌ Falló: ${errorMsg}`)
      errors.push(errorMsg)
      continue
    }
  }

  throw new Error(`Todos los proveedores fallaron:\n${errors.join('\n')}`)
}

function generateResultMessage(media, actualSize) {
  let message = `╔══════════════════╗\n`
  message += `║  ✅ DESCARGA EXITOSA  ║\n`
  message += `╚══════════════════╝\n\n`
  
  message += `📹 *Título:* ${media.title || 'Video de Facebook'}\n\n`
  message += `📊 *Tipo:* ${media.type === 'video' ? 'Video' : 'Imagen'}\n`
  
  if (media.quality) {
    message += `🎬 *Calidad:* ${media.quality}\n`
  }
  
  if (actualSize) {
    message += `💾 *Tamaño:* ${formatFileSize(actualSize)}\n`
  }
  
  if (media.source) {
    message += `🔗 *Fuente:* ${media.source}\n`
  }
  
  message += `\n_Descarga completada con éxito_`
  
  return message
}

/* ======================== HANDLER PRINCIPAL ======================== */

const handler = async (m, { conn, args, command, usedPrefix }) => {
  let waitMsg = null
  
  try {
    if (!args[0]) {
      return m.reply(
        `╔══════════════════╗\n` +
        `║  ❌ USO INCORRECTO  ║\n` +
        `╚══════════════════╝\n\n` +
        `Debes proporcionar un enlace de Facebook.\n\n` +
        `📝 *Ejemplo:*\n${usedPrefix + command} https://www.facebook.com/watch?v=123456\n\n` +
        `💡 *Tip:* El video debe ser público`
      )
    }

    const url = args[0].trim()

    if (!isValidFacebookUrl(url)) {
      return m.reply(
        `╔══════════════════╗\n` +
        `║  ⚠️ URL INVÁLIDA  ║\n` +
        `╚══════════════════╝\n\n` +
        `El enlace debe ser de Facebook o fb.watch.\n` +
        `Asegúrate de que el video sea público.\n\n` +
        `✅ URLs válidas:\n` +
        `• facebook.com/watch?v=...\n` +
        `• fb.watch/...\n` +
        `• facebook.com/reel/...\n` +
        `• facebook.com/videos/...`
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
        `⚠️ @${m.sender.split('@')[0]}, ya tienes una descarga en progreso.\n\nPor favor espera a que termine.`,
        m,
        { mentions: [m.sender] }
      )
    }

    activeDownloads.add(m.sender)
    await m.react('🔍')

    // Mensaje inicial
    waitMsg = await conn.reply(
      m.chat,
      `🔍 *Buscando video en Facebook...*\n\n⏳ Esto puede tomar unos segundos...`,
      m
    )

    let media = null
    
    try {
      media = await tryProviders(url)
      console.log('✅ Media obtenida correctamente')
      console.log(`📋 Título final: ${media.title}`)
    } catch (error) {
      console.error('❌ Error en tryProviders:', error)
      throw new Error(
        `No se pudo obtener el contenido.\n\n` +
        `Posibles causas:\n` +
        `• El video no es público\n` +
        `• El enlace ha expirado\n` +
        `• El video fue eliminado\n` +
        `• Facebook está bloqueando las descargas`
      )
    }

    if (!media.url || !media.url.startsWith('http')) {
      throw new Error('URL de descarga inválida')
    }

    await m.react('📊')

    // Obtener tamaño real del archivo
    const estimatedSize = await getRemoteFileSize(media.url)
    
    if (estimatedSize && estimatedSize > CONFIG.MAX_FILE_SIZE) {
      const sizeMB = formatFileSize(estimatedSize)
      const maxSizeMB = formatFileSize(CONFIG.MAX_FILE_SIZE)
      
      await conn.sendMessage(m.chat, { delete: waitMsg.key })
      await conn.reply(
        m.chat,
        `╔══════════════════╗\n` +
        `║  ⚠️ ARCHIVO GRANDE  ║\n` +
        `╚══════════════════╝\n\n` +
        `📋 *Título:* ${media.title}\n` +
        `💾 *Tamaño:* ${sizeMB}\n` +
        `🚫 *Límite:* ${maxSizeMB}\n\n` +
        `El archivo es demasiado grande para enviar.\n\n` +
        `🔗 *Enlace directo:*\n${media.url}`,
        m
      )
      
      await m.react('⚠️')
      return
    }

    const fileName = `facebook_${Date.now()}.mp4`
    
    // Actualizar mensaje: Descargando
    await conn.sendMessage(m.chat, {
      text: `📥 *Descargando video...*\n\n` +
            `📋 Título: ${media.title}\n` +
            `💾 Tamaño: ${formatFileSize(estimatedSize) || 'Calculando...'}\n\n` +
            `⏳ Por favor espera...`,
      edit: waitMsg.key
    })

    await m.react('⬇️')

    // Descargar con callback de progreso
    let lastProgressUpdate = 0
    const downloadResult = await downloadToBuffer(media.url, async (progress, downloaded, total) => {
      const now = Date.now()
      // Actualizar mensaje cada 3 segundos
      if (now - lastProgressUpdate > 3000) {
        lastProgressUpdate = now
        try {
          const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5))
          await conn.sendMessage(m.chat, {
            text: `📥 *Descargando video...*\n\n` +
                  `📋 ${media.title}\n\n` +
                  `${progressBar} ${progress}%\n\n` +
                  `💾 ${formatFileSize(downloaded)} / ${formatFileSize(total)}`,
            edit: waitMsg.key
          })
        } catch (e) {
          // Ignorar errores de edición
        }
      }
    })

    const buffer = downloadResult.buffer
    const actualSize = downloadResult.size

    console.log(`✅ Buffer obtenido: ${formatFileSize(actualSize)}`)

    // Actualizar mensaje: Enviando
    await conn.sendMessage(m.chat, {
      text: `📤 *Enviando tu video...*\n\n` +
            `📋 ${media.title}\n` +
            `💾 ${formatFileSize(actualSize)}\n\n` +
            `⏳ Espera un momento...`,
      edit: waitMsg.key
    })

    await m.react('📤')

    const caption = generateResultMessage(media, actualSize)

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

    console.log('✅ Archivo enviado exitosamente')
    await m.react('✅')
    
    // Eliminar mensaje de progreso
    try {
      await conn.sendMessage(m.chat, { delete: waitMsg.key })
    } catch (e) {
      // Ignorar
    }

  } catch (error) {
    console.error('❌ Handler error:', error)
    
    await m.reply(
      `╔══════════════════╗\n` +
      `║  ❌ ERROR  ║\n` +
      `╚══════════════════╝\n\n` +
      `${error.message}\n\n` +
      `💡 *Sugerencias:*\n` +
      `• Verifica que el enlace sea correcto\n` +
      `• Asegúrate de que el video sea público\n` +
      `• Intenta con otro video\n` +
      `• Espera unos minutos e intenta de nuevo`
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