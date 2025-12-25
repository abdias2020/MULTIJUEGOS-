import { db } from '../lib/postgres.js'
import { getSubbotConfig, setSubbotConfig } from '../lib/postgres.js'
import chalk from 'chalk'

const comandosPermitidos = [
  'code',
  'serbot',
  'jadibot',
  'bots',
  'piedra',
  'tijera',
  'papel'
]

// ================= BEFORE =================
export async function before(m, { conn, isOwner }) {
  const botId = conn.user?.id || globalThis.conn.user.id
  const config = await getSubbotConfig(botId)

  if (!config?.anti_private) return
  if (m.isGroup || m.fromMe || isOwner) return

  const sender = m.sender
  const texto =
    m.originalText?.toLowerCase().trim() ||
    m.text?.toLowerCase().trim() ||
    ''

  if (!texto) return

  const prefixes = Array.isArray(config.prefix)
    ? config.prefix
    : [config.prefix || '/']

  let usedPrefix = ''
  for (const p of prefixes) {
    if (texto.startsWith(p)) {
      usedPrefix = p
      break
    }
  }

  const withoutPrefix = texto.slice(usedPrefix.length).trim()
  const [commandName] = withoutPrefix.split(/\s+/)
  const command = commandName?.toLowerCase()

  if (comandosPermitidos.includes(command)) return

  try {
    const res = await db.query(
      `SELECT warn_pv FROM usuarios WHERE id = $1`,
      [sender]
    )

    if (!res.rowCount) {
      await db.query(
        `INSERT INTO usuarios (id, warn_pv) VALUES ($1, true)`,
        [sender]
      )

      await m.reply(
        `🚫 *COMANDOS EN PRIVADO DESHABILITADOS*\n\n` +
        `🔰 *Sub-bot permitido con:*\n` +
        `/serbot\n/code\n\n` +
        `👉 Únete al grupo oficial:\n` +
        `${[info.nn, info.nn2, info.nn3, info.nn4, info.nn5, info.nn6].getRandom()}`
      )
      return false
    }

    if (!res.rows[0].warn_pv) {
      await db.query(
        `UPDATE usuarios SET warn_pv = true WHERE id = $1`,
        [sender]
      )

      await m.reply(
        `🚫 *COMANDOS EN PRIVADO DESHABILITADOS*\n\n` +
        `🔰 *Sub-bot permitido con:*\n` +
        `/serbot\n/code\n\n` +
        `👉 Únete al grupo oficial:\n` +
        `${[info.nn, info.nn2, info.nn3, info.nn4, info.nn5, info.nn6].getRandom()}`
      )
    }

    return false
  } catch (e) {
    console.log(chalk.red('❌ Error antiprivate:'), e.message)
    return false
  }
}

// ================= COMANDO =================
const handler = async (m, { args, isOwner }) => {
  if (!isOwner) {
    return m.reply('⛔ Solo el *OWNER* puede usar este comando')
  }

  const option = args[0]?.toLowerCase()

  if (!['on', 'off'].includes(option)) {
    return m.reply(
      `📌 *Uso correcto*\n\n` +
      `• Activar: *antiprivate on*\n` +
      `• Desactivar: *antiprivate off*`
    )
  }

  const status = option === 'on'

  try {
    await setSubbotConfig(m.conn.user.id, {
      anti_private: status
    })

    await m.reply(
      status
        ? '✅ *Anti-Privado ACTIVADO*\nLos comandos en privado están bloqueados'
        : '❎ *Anti-Privado DESACTIVADO*\nLos comandos en privado están permitidos'
    )
  } catch (e) {
    console.log(chalk.red('❌ Error guardando antiprivate:'), e.message)
    await m.reply('❌ Error al actualizar la configuración')
  }
}

handler.help = ['antiprivate on', 'antiprivate off']
handler.tags = ['owner']
handler.command = /^antiprivate$/i
handler.owner = true

export default handler