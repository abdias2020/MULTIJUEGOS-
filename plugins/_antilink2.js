import { db } from '../lib/postgres.js';

// ================= REGEX =================
const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/channel\/[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)[^\s]*)/gi;

const domainRegex = /\b[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)\b/gi;

// ================= BEFORE (ANTILINK2) =================
export async function before(m, { conn }) {
  if (!m.isGroup || m.fromMe) return;

  const messageText =
    m.text ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    '';

  if (!messageText) return;

  const groupId = m.chat;
  const messageId = m.key.id;
  const senderId = m.sender;
  const participant = m.key.participant || senderId;

  // 1️⃣ Estado antilink2
  let antilink2Active = false;
  try {
    const res = await db.query(
      'SELECT antilink2 FROM group_settings WHERE group_id = $1',
      [groupId]
    );
    antilink2Active = res.rows[0]?.antilink2 === true;
  } catch (e) {
    console.error('❌ Error verificando antilink2:', e.message);
    return;
  }

  if (!antilink2Active) return;

  // 2️⃣ Detectar links
  if (!linkRegex.test(messageText) && !domainRegex.test(messageText)) return;

  // 3️⃣ Metadata
  let metadata;
  try {
    metadata = await conn.groupMetadata(groupId);
  } catch (e) {
    console.error('❌ Error metadata:', e.message);
    return;
  }

  const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';

  const isBotAdmin = metadata.participants.some(
    p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
  );

  const isSenderAdmin = metadata.participants.some(
    p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
  );

  if (isSenderAdmin) return;

  // 4️⃣ Permitir link del MISMO grupo
  let groupLink = null;
  try {
    const invite = await conn.groupInviteCode(groupId);
    groupLink = `https://chat.whatsapp.com/${invite}`;

    const textNorm = messageText.toLowerCase().replace(/\s+/g, '');
    if (textNorm.includes(invite.toLowerCase()) || textNorm.includes(groupLink.toLowerCase())) {
      return;
    }
  } catch (e) {
    console.warn('⚠️ No se pudo obtener invite:', e.message);
  }

  // 5️⃣ Bot sin admin
  if (!isBotAdmin) {
    await conn.sendMessage(groupId, {
      text: `⚠️ *ANTILINK2 ACTIVADO*\n\n@${senderId.split('@')[0]} envió un link externo.\n\n❌ No puedo eliminarlo (no soy admin).`,
      mentions: [senderId]
    });
    return;
  }

  // 6️⃣ Eliminar mensaje
  try {
    await conn.sendMessage(groupId, {
      delete: {
        remoteJid: groupId,
        fromMe: false,
        id: messageId,
        participant
      }
    });

    await new Promise(r => setTimeout(r, 500));

    await conn.sendMessage(groupId, {
      text: `🚫 *LINK EXTERNO ELIMINADO*\n\n@${senderId.split('@')[0]}\n\n✅ *Link permitido:* ${groupLink ?? 'solo el del grupo'}`,
      mentions: [senderId]
    });

  } catch (e) {
    console.error('❌ Error eliminando link:', e.message);
  }
}

// ================= COMANDO ANTILINK2 =================
const handler = async (m, { args, conn }) => {
  if (!m.isGroup) {
    return m.reply('❌ Este comando solo funciona en grupos');
  }

  const metadata = await conn.groupMetadata(m.chat);
  const isAdmin = metadata.participants.some(
    p => p.id === m.sender && (p.admin === 'admin' || p.admin === 'superadmin')
  );

  if (!isAdmin) {
    return m.reply('⛔ Solo los administradores pueden usar este comando');
  }

  const option = args[0]?.toLowerCase();

  if (!['on', 'off'].includes(option)) {
    return m.reply(
      `📌 *Uso correcto*\n\n` +
      `• Activar: *antilink2 on*\n` +
      `• Desactivar: *antilink2 off*`
    );
  }

  const status = option === 'on';

  try {
    await db.query(
      `INSERT INTO group_settings (group_id, antilink2)
       VALUES ($1, $2)
       ON CONFLICT (group_id)
       DO UPDATE SET antilink2 = $2`,
      [m.chat, status]
    );

    await m.reply(
      status
        ? '✅ *Antilink2 ACTIVADO*\nSolo se permite el link del grupo'
        : '❎ *Antilink2 DESACTIVADO*'
    );

  } catch (e) {
    console.error('❌ Error DB antilink2:', e.message);
    await m.reply('❌ Error al actualizar antilink2');
  }
};

handler.help = ['antilink2 on', 'antilink2 off'];
handler.tags = ['group'];
handler.command = /^antilink2$/i;
handler.admin = true;
handler.group = true;

export default handler;