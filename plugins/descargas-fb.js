import axios from 'axios'
import * as cheerio from 'cheerio'
import qs from 'qs'

/* ======================== FACEBOOK SCRAPER ======================== */
const TARGET_URL = 'https://fdownloader.net/es'

async function facebookDl(url) {
  try {
    // 1️⃣ Obtener tokens dinámicos de la página principal
    console.log('📡 Obteniendo tokens...')
    const page = await axios.get(TARGET_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    const html = page.data
    const k_exp = html.match(/k_exp="(.*?)"/)?.[1]
    const k_token = html.match(/k_token="(.*?)"/)?.[1]

    if (!k_exp || !k_token) {
      throw new Error('No se pudieron obtener los tokens de autenticación')
    }

    console.log('✅ Tokens obtenidos')

    // 2️⃣ Buscar información del video
    console.log('🔍 Buscando video...')
    const search = await axios.post(
      'https://v3.fdownloader.net/api/ajaxSearch',
      qs.stringify({
        k_exp,
        k_token,
        q: url,
        lang: 'es',
        web: 'fdownloader.net',
        v: 'v2',
        w: '',
        cftoken: ''
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://fdownloader.net',
          'Referer': 'https://fdownloader.net/'
        }
      }
    )

    if (search.data.status !== 'ok') {
      throw new Error('No se pudo procesar el video de Facebook')
    }

    console.log('✅ Video encontrado')

    const $ = cheerio.load(search.data.data)
    const result = {}

    // 3️⃣ Extraer enlaces de descarga directa (SD / HD)
    $('a.download-link-fb').each((_, el) => {
      const quality = $(el).closest('tr').find('.video-quality').text().trim()
      const link = $(el).attr('href')
      if (quality && link) {
        result[quality] = link
        console.log(`📹 Encontrado: ${quality}`)
      }
    })

    // 4️⃣ Detectar y procesar 1080p (requiere conversión)
    const renderBtn = $('button[onclick*="convertFile"]')
    if (renderBtn.length) {
      console.log('🎬 Detectado video 1080p, iniciando conversión...')
      
      const videoUrl = renderBtn.attr('data-videourl')
      const videoCodec = renderBtn.attr('data-videocodec')
      const videoType = renderBtn.attr('data-videotype')
      const fquality = renderBtn.attr('data-fquality')

      const audioUrl = $('#audioUrl').val()
      const audioType = $('#audioType').val()
      const v_id = $('#FbId').val()

      const c_token = search.data.data.match(/c_token\s*=\s*"(.*?)"/)?.[1]
      const exp = search.data.data.match(/k_exp\s*=\s*"(.*?)"/)?.[1]
      const convertUrl =
        search.data.data.match(/k_url_convert\s*=\s*"(.*?)"/)?.[1] ||
        'https://s3.vidcdn.app/api/json/convert'

      if (videoUrl && audioUrl && c_token) {
        const convert = await axios.post(
          convertUrl,
          qs.stringify({
            ftype: 'mp4',
            v_id,
            videoUrl,
            videoType,
            videoCodec,
            audioUrl,
            audioType,
            fquality,
            fname: 'FDownloader.net',
            exp,
            token: c_token,
            cv: 'v2'
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Origin': 'https://fdownloader.net',
              'Referer': 'https://fdownloader.net/'
            }
          }
        )

        if (convert.data?.result) {
          result['1080p'] = convert.data.result
          console.log('✅ 1080p convertido exitosamente')
        }
      }
    }

    if (!Object.keys(result).length) {
      throw new Error('No se encontraron enlaces de descarga')
    }

    return result
  } catch (error) {
    console.error('❌ Error en scraper:', error.message)
    throw error
  }
}

/* ======================== HANDLER DEL BOT ======================== */
const handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    // Validar que se proporcionó una URL
    if (!args[0]) {
      return m.reply(
        `❌ *Uso incorrecto*\n\n` +
        `📌 Ejemplo:\n` +
        `${usedPrefix + command} https://facebook.com/share/r/1GuSFwLsks/\n\n` +
        `💡 También funciona con:\n` +
        `• facebook.com/watch\n` +
        `• fb.watch\n` +
        `• m.facebook.com`
      )
    }

    const fbUrl = args[0].trim()
    
    // Validar que sea una URL de Facebook válida
    if (!/(facebook\.com|fb\.watch)/i.test(fbUrl)) {
      return m.reply('⚠️ Por favor proporciona un enlace válido de Facebook')
    }

    // Reacciones de estado
    await m.react('⏳')
    const waitMsg = await m.reply('🔎 *Procesando video de Facebook...*\n\n_Esto puede tomar unos segundos..._')

    // Obtener los enlaces de descarga
    const links = await facebookDl(fbUrl)

    // Seleccionar la mejor calidad disponible
    // Prioridad: 1080p > HD > SD > Cualquier otro
    const videoUrl =
      links['1080p'] ||
      links['HD'] ||
      links['SD'] ||
      Object.values(links)[0]

    const quality =
      links['1080p'] ? '1080p (Full HD)' :
      links['HD'] ? 'HD (720p)' :
      links['SD'] ? 'SD (480p)' :
      'Calidad estándar'

    console.log(`📥 Descargando video en calidad: ${quality}`)

    // Enviar el video al chat
    await conn.sendMessage(
      m.chat,
      {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption:
          `╔════════════════════╗\n` +
          `║  ✅ *FACEBOOK VIDEO*  ║\n` +
          `╚════════════════════╝\n\n` +
          `🎥 *Calidad:* ${quality}\n` +
          `📱 *Descargado por:* @${m.sender.split('@')[0]}\n\n` +
          `_Bot desarrollado con ❤️_`,
        mentions: [m.sender]
      },
      { quoted: m }
    )

    // Eliminar mensaje de espera y reaccionar
    await conn.sendMessage(m.chat, { delete: waitMsg.key })
    await m.react('✅')

  } catch (e) {
    console.error('Error completo:', e)
    
    // Mensaje de error detallado
    let errorMsg = '❌ *Error al descargar el video*\n\n'
    
    if (e.message.includes('tokens')) {
      errorMsg += '🔐 No se pudieron obtener los tokens de autenticación'
    } else if (e.message.includes('procesar')) {
      errorMsg += '📹 El video no está disponible o es privado'
    } else if (e.message.includes('enlaces')) {
      errorMsg += '🔗 No se encontraron enlaces de descarga'
    } else {
      errorMsg += `⚠️ ${e.message}`
    }
    
    errorMsg += '\n\n💡 *Intenta con:*\n'
    errorMsg += '• Verificar que el video sea público\n'
    errorMsg += '• Usar otro enlace de Facebook\n'
    errorMsg += '• Intentar de nuevo en unos minutos'
    
    await m.reply(errorMsg)
    await m.react('❌')
  }
}

/* ======================== METADATA ======================== */
handler.help = ['facebook <url>']
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbdl)$/i
handler.limit = 1

export default handler