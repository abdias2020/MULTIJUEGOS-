import axios from 'axios'
import * as cheerio from 'cheerio'
import qs from 'qs'

/* ======================== FACEBOOK SCRAPER ======================== */
const TARGET_URL = 'https://fdownloader.net/es'

async function facebookDl(url) {
  // 1️⃣ Obtener tokens dinámicos
  const page = await axios.get(TARGET_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  })

  const html = page.data
  const k_exp = html.match(/k_exp="(.*?)"/)?.[1]
  const k_token = html.match(/k_token="(.*?)"/)?.[1]

  if (!k_exp || !k_token) {
    throw new Error('No se pudieron obtener los tokens')
  }

  // 2️⃣ Buscar video
  const search = await axios.post(
    'https://v3.fdownloader.net/api/ajaxSearch',
    qs.stringify({
      k_exp,
      k_token,
      q: url,
      lang: 'es',
      web: 'fdownloader.net',
      v: 'v2'
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0',
        Origin: 'https://fdownloader.net',
        Referer: 'https://fdownloader.net/'
      }
    }
  )

  if (search.data.status !== 'ok') {
    throw new Error('No se pudo procesar el video')
  }

  const $ = cheerio.load(search.data.data)
  const result = {}

  // 3️⃣ Enlaces normales (SD / HD)
  $('a.download-link-fb').each((_, el) => {
    const quality = $(el).closest('tr').find('.video-quality').text().trim()
    const link = $(el).attr('href')
    if (quality && link) result[quality] = link
  })

  // 4️⃣ Detectar 1080p (render / convert)
  const renderBtn = $('button[onclick*="convertFile"]')
  if (renderBtn.length) {
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
          fname: 'Facebook',
          exp,
          token: c_token,
          cv: 'v2'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0',
            Origin: 'https://fdownloader.net',
            Referer: 'https://fdownloader.net/'
          }
        }
      )

      if (convert.data?.result) {
        result['1080p'] = convert.data.result
      }
    }
  }

  if (!Object.keys(result).length) {
    throw new Error('No se encontraron enlaces')
  }

  return result
}

/* ======================== HANDLER ======================== */
const handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    if (!args[0]) {
      return m.reply(
        `❌ Uso incorrecto\n\nEjemplo:\n${usedPrefix + command} https://facebook.com/...`
      )
    }

    const fbUrl = args[0].trim()
    if (!/(facebook\.com|fb\.watch)/i.test(fbUrl)) {
      return m.reply('⚠️ Enlace de Facebook inválido')
    }

    await m.react('⏳')
    const waitMsg = await m.reply('🔎 Procesando video de Facebook...')

    const links = await facebookDl(fbUrl)

    // Prioridad: 1080p > HD > SD
    const videoUrl =
      links['1080p'] ||
      links['HD'] ||
      links['SD'] ||
      Object.values(links)[0]

    const quality =
      links['1080p'] ? '1080p' :
      links['HD'] ? 'HD' : 'SD'

    await conn.sendMessage(
      m.chat,
      {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption:
          `╔══════════════════╗\n` +
          `║  ✅ FACEBOOK LISTO  ║\n` +
          `╚══════════════════╝\n\n` +
          `🎥 Calidad: ${quality}`
      },
      { quoted: m }
    )

    await conn.sendMessage(m.chat, { delete: waitMsg.key })
    await m.react('✅')

  } catch (e) {
    await m.reply(`❌ Error:\n${e.message}`)
    await m.react('❌')
  }
}

/* ======================== METADATA ======================== */
handler.help = ['facebook <url>']
handler.tags = ['downloader']
handler.command = /^(facebook|fb|fbdl)$/i
handler.limit = 1

export default handler