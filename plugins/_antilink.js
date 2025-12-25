import { db } from '../lib/postgres.js'

// ================= REGEX =================
const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/channel\/[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)[^\s]*)/gi

const domainRegex = /\b[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)\b/gi

// ================= BEFORE (ANTILINK) =================
export async function before(m, { conn }) {
  if (!m.isGroup || m.fromMe) return

  const messageText =
    m.text ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    ''

  if (!messageText) return

  const groupId = m.chat
  const messageId = m.key.id
  const senderId = m.sender
  const participant = m.key.participant || senderId

  // 🔍 Estado del antilink
  let antilinkActive = false
  try {
    const res = await db.query(
      'SELECT antilink FROM group_settings WHERE group_id = $1',
      [groupId]
    )
    antilinkActive = res.rows[0]?.antilink === true
  } catch (e) {
    console.error('❌ Error antilink DB:', e.message)
    return
  }

  if (!antilinkActive) return

  // 🔗 Detectar link
  if (!linkRegex.test(messageText) && !domainRegex.test(messageText)) return

  // 📋 Metadata
  const metadata = await conn.groupMetadata(groupId)
  const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net'

  const isBotAdmin = metadata.participants.some(
    p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
  )

  const isSenderAdmin = metadata.participants.some(
    p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
  )

  if (isSenderAdmin) return

  // ⚠️ Bot sin admin
  if (!isBotAdmin) {
    await conn.sendMessage(groupId, {
      text: `⚠️ *ANTILINK ACTIVADO*\n\n@${senderId.split('@')[0]} envió un link, pero no puedo eliminarlo.`,
      mentions: [senderId]
    })
    return
  }

  // 🗑️ Eliminar mensaje
  try {
    await conn.sendMessage(groupId, {
      delete: {
        remoteJid: groupId,
        fromMe: false,
        id: messageId,
        participant
      }
    })

    await conn.sendMessage(groupId, {
      text: `🚫 *LINK ELIMINADO*\n\n@${senderId.split('@')[0]} los links están prohibidos.`,
      mentions: [senderId]
    })

  } catch (e) {
    console.error('❌ Error eliminando link:', e.message)
  }
}

// ================= COMANDO ANTILINK =================
const handler = async (m, { conn, args }) => {
  if (!m.isGroup) {
    return m.reply('❌ Este comando solo funciona en grupos')
  }

  const metadata = await conn.groupMetadata(m.chat)
  const isAdmin = metadata.participants.some(
    p => p.id === m.sender && (p.admin === 'admin' || p.admin === 'superadmin')
  )

  if (!isAdmin) {
    return m.reply('⛔ Solo los administradores pueden usar este comando')
  }

  const option = args[0]?.toLowerCase()

  if (!option || !['on', 'off'].includes(option)) {
    return m.reply(
      `📌 *Uso correcto*\n\n` +
      `• Activar: *antilink on*\n` +
      `• Desactivar: *antilink off*`
    )
  }

  const status = option === 'on'

  try {
    await db.query(
      `INSERT INTO group_settings (group_id, antilink)
       VALUES ($1, $2)
       ON CONFLICT (group_id)
       DO UPDATE SET antilink = $2`,
      [m.chat, status]
    )

    await m.reply(
      status
        ? '✅ *Antilink ACTIVADO*'
        : '❎ *Antilink DESACTIVADO*'
    )

  } catch (e) {
    console.error('❌ Error guardando antilink:', e.message)
    await m.reply('❌ Error al actualizar la configuración')
  }
}

handler.help = ['antilink on', 'antilink off']
handler.tags = ['group']
handler.command = /^antilink$/i
handler.admin = true
handler.group = true

export default handler