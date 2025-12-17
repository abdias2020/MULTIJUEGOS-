import { db } from '../lib/postgres.js';

// Detecta CUALQUIER link
const linkRegex = /(https?:\/\/|www\.|t\.me\/|wa\.me\/|chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)/i;

export async function before(m, { conn }) {
  if (!m.isGroup || !m.originalText) return;

  const messageId = m.key.id;
  const participant = m.key.participantAlt || m.key.participant || m.sender;

  // Verificar si antilink está activo
  try {
    const res = await db.query(
      'SELECT antilink FROM group_settings WHERE group_id = $1',
      [m.chat]
    );
    if (!res.rows[0]?.antilink) return;
  } catch (e) {
    console.error(e);
    return;
  }

  // Detectar cualquier link
  if (!linkRegex.test(m.originalText)) return;

  const metadata = await conn.groupMetadata(m.chat);
  const botId = conn.user?.id?.replace(/:\d+@/, '@');

  // ¿El bot es admin?
  const isBotAdmin = metadata.participants.some(p => {
    const id = p.id?.replace(/:\d+/, '');
    return id === botId && p.admin;
  });

  // ¿El remitente es admin?
  const senderIds = [m.sender, m.lid]
    .filter(Boolean)
    .map(j => j.replace(/:\d+/, ''));

  const isSenderAdmin = metadata.participants.some(p => {
    const id = p.id?.replace(/:\d+/, '');
    return senderIds.includes(id) && p.admin;
  });

  // Admins y el bot pueden enviar links
  if (isSenderAdmin || m.fromMe) return;

  // Si el bot no es admin, no puede borrar
  if (!isBotAdmin) return;

  // Borrar automáticamente el mensaje
  try {
    await conn.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: false,
        id: messageId,
        participant
      }
    });
  } catch (err) {
    console.error(err);
  }
}