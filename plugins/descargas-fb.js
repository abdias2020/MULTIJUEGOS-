import cheerio from 'cheerio'
import fetch from 'node-fetch'

/* ======================== FACEBOOK SCRAPER ======================== */
async function facebookDl(url) {
  const res = await fetch('https://fdownloader.net/')
  const html = await res.text()
  const $ = cheerio.load(html)

  const token = $('input[name="__RequestVerificationToken"]').attr('value')
  if (!token) throw new Error('No se pudo obtener token')

  const response = await fetch('https://fdownloader.net/api/ajaxSearch', {
    method: 'POST',
    headers: {
      cookie: res.headers.get('set-cookie'),
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      referer: 'https://fdownloader.net/'
    },
    body: new URLSearchParams({
      __RequestVerificationToken: token,
      q: url
    })
  })

  const json = await response.json()
  if (!json?.data) throw new Error('No se pudo procesar el video')

  const $$ = cheerio.load(json.data)
  const result = {}

  $$('.button.is-success.is-small.download-link-fb').each(function () {
    const quality = $$(this).attr('title')?.split(' ')[1] // HD / SD
    const link = $$(this).attr('href')
    if (quality && link) result[quality] = link
  })

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
        `❌ Uso incorrecto\n\nEjemplo:\n${usedPrefix + command} https://fb.watch/...`
      )
    }

    const fbUrl = args[0].trim()
    if (!/(facebook\.com|fb\.watch)/i.test(fbUrl)) {
      return m.reply('⚠️ Enlace de Facebook inválido')
    }

    await m.react('🔍')
    const waitMsg = await m.reply('🔎 Buscando video de Facebook...')

    const links = await facebookDl(fbUrl)

    const videoUrl = links.HD || links.SD
    if (!videoUrl) throw new Error('No hay video disponible')

    await conn.sendMessage(
      m.chat,
      {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption:
          `╔══════════════════╗\n` +
          `║  ✅ FACEBOOK LISTO  ║\n` +
          `╚══════════════════╝\n\n` +
          `🎥 Calidad: ${links.HD ? 'HD' : 'SD'}`
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