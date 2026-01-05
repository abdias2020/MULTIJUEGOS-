import axios from 'axios'
import * as cheerio from 'cheerio'
import qs from 'qs'

/* ======================== FACEBOOK SCRAPER ======================== */
const TARGET_URL = 'https://fdownloader.net/es'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function facebookDl(url) {
  // 1️⃣ Tokens dinámicos
  const page = await axios.get(TARGET_URL, { headers: { 'User-Agent': UA } })
  const html = page.data

  const k_exp = html.match(/k_exp="(.*?)"/)?.[1]
  const k_token = html.match(/k_token="(.*?)"/)?.[1]
  const k_url_search =
    html.match(/k_url_search="(.*?)"/)?.[1] ||
    'https://v3.fdownloader.net/api/ajaxSearch'

  if (!k_exp || !k_token) {
    throw new Error('No se pudieron obtener los tokens')
  }

  // 2️⃣ Búsqueda del video
  const search = await axios.post(
    k_url_search,
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
        'User-Agent': UA,
        Origin: 'https://fdownloader.net',
        Referer: 'https://fdownloader.net/'
      }
    }
  )

  if (search.data.status !== 'ok') {
    throw new Error('No se pudo procesar el video')
  }

  // 3️⃣ Parsear HTML
  const $ = cheerio.load(search.data.data)
  const results = []

  $('a.download-link-fb').each((_, el) => {
    const qualityText = $(el)
      .closest('tr')
      .find('.video-quality')
      .text()
      .trim()
      .toUpperCase()

    const link = $(el).attr('href')
    if (!link) return

    let quality = null
    if (qualityText.includes('HD')) quality = 'HD'
    else if (qualityText.includes('SD')) quality = 'SD'

    if (quality) {
      results.push({ quality, url: link })
    }
  })

  if (!results.length) {
    throw new Error('No se encontraron enlaces de descarga')
  }

  return results
}

/* ======================== HANDLER ======================== */
const handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    if (!args[0]) {
      return m.reply(
        `❌ *Uso incorrecto*\n\n` +
        `📌 Ejemplo:\n` +
        `${usedPrefix + command} https://facebook.com/share/r/xxxx`
      )
    }

    const fbUrl = args[0].trim()
    if (!/(facebook\.com|fb\.watch)/i.test(fbUrl)) {
      return m.reply('⚠️ Proporciona un enlace válido de Facebook')
    }

    await m.react('⏳')
    const wait = await m.reply('🔎 Procesando video de Facebook...')

    const links = await facebookDl(fbUrl)

    // 🧠 LÓGICA CLAVE (PYTHON STYLE)
    const hd = links.find(v => v.quality === 'HD')
    const sd = links.find(v => v.quality === 'SD')
    const selected = hd || sd

    if (!selected) {
      throw new Error('No se pudo seleccionar una calidad válida')
    }

    const qualityLabel =
      selected.quality === 'HD'
        ? 'HD (720p)'
        : 'SD (480p)'

    await conn.sendMessage(
      m.chat,
      {
        video: { url: selected.url },
        mimetype: 'video/mp4',
        caption:
          `╔════════════════════╗\n` +
          `║  ✅ *FACEBOOK VIDEO*  ║\n` +
          `╚════════════════════╝\n\n` +
          `🎥 *Calidad:* ${qualityLabel}\n` +
          `📱 *Solicitado por:* @${m.sender.split('@')[0]}`,
        mentions: [m.sender]
      },
      { quoted: m }
    )

    await conn.sendMessage(m.chat, { delete: wait.key })
    await m.react('✅')

  } catch (e) {
    console.error(e)
    await m.react('❌')
    await m.reply(
      `❌ *No se pudo descargar el video*\n\n` +
      `💡 Posibles causas:\n` +
      `• El video es privado\n` +
      `• Facebook bloqueó el acceso\n` +
      `• Solo existe una calidad no soportada`
    )
  }
}

/* ======================== METADATA ======================== */
handler.help = ['facebook <url>']
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbdl)$/i
handler.limit = 1

export default handler