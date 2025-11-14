import fetch from 'node-fetch'

const userRequests = new Map()

const handler = async (m, { conn, args, usedPrefix, command }) => {
  const sticker = 'https://qu.ax/Wdsb.webp'

  if (!args[0])
    return m.reply(
      `⚠️ Ingrese un enlace válido de *Mediafire*\nEjemplo:\n${usedPrefix + command} https://www.mediafire.com/file/xxxxxx/app.apk/file`
    )

  if (userRequests.has(m.sender))
    return conn.reply(
      m.chat,
      `⚠️ Hey @${m.sender.split('@')[0]} ya estás descargando algo 🙄\nEspera a que termine tu solicitud actual antes de hacer otra.`,
      m
    )

  userRequests.set(m.sender, true)
  m.react('🚀')

  try {
    // 🔧 Tu nueva API oficial
    const apiKey = 'RrSyVm056GfAhjuM'
    const url = `https://api-nv.ultraplus.click/api/download/mediafire?url=${encodeURIComponent(
      args[0]
    )}&key=${apiKey}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
    const json = await res.json()

    if (!json.status || !json.result)
      throw new Error('No se obtuvo una respuesta válida de la API')

    const file = json.result

    const caption = `
┏━━『 𝐌𝐄𝐃𝐈𝐀𝐅𝐈𝐑𝐄 』━━•
┃❥ 𝐍𝐨𝐦𝐛𝐫𝐞 : ${file.fileName}
┃❥ 𝐏𝐞𝐬𝐨 : ${file.size}
┃❥ 𝐓𝐢𝐩𝐨 : ${file.fileType}
┃❥ 𝐒𝐮𝐛𝐢𝐝𝐨 : ${file.uploaded}
╰━━━⊰ 𓃠 ULTRAPLUS API ⊱━━━━•
> ⏳ ᴱˢᵖᵉʳᵉ ᵘⁿ ᵐᵒᵐᵉⁿᵗᵒ, ᵉⁿᵛᶦᵃⁿᵈᵒ ᵉˡ ᵃʳᶜʰᶦᵛᵒ…
    `.trim()

    await conn.reply(m.chat, caption, m)
    await conn.sendFile(m.chat, file.directLink, file.fileName, '', m, null, {
      mimetype: 'application/octet-stream',
      asDocument: true
    })

    m.react('✅')
  } catch (e) {
    console.error(e)
    await conn.sendFile(m.chat, sticker, 'error.webp', '', m)
    m.react('❌')
    await m.reply(
      '❌ Error al descargar el archivo.\nVerifica que el enlace de Mediafire sea válido o que tu API esté disponible.'
    )
  } finally {
    userRequests.delete(m.sender)
  }
}

handler.help = ['mediafire', 'mediafiredl']
handler.tags = ['downloader']
handler.command = /^(mediafire|mediafiredl|dlmediafire)$/i
handler.register = true
handler.limit = 3

export default handler