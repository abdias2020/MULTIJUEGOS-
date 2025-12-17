import { db } from '../lib/postgres.js';

// Detecta cualquier link
const linkRegex = /(https?:\/\/|www\.)\S+/i;

export async function before(m, { conn }) {
  if (!m.isGroup || !m.originalText) return;

  const messageId = m.key.id;
  const participant = m.key.participantAlt || m.key.participant || m.sender;

  // Verificar si antilink2 está activo
  try {
    const res = await db.query(
      'SELECT antilink2 FROM group_settings WHERE group_id = $1',
      [m.chat]
    );
    if (!res.rows[0]?.antilink2) return;
  } catch (e) {
    console.error(e);
    return;
  }

  // Detectar link
  if (!linkRegex.test(m.originalText)) return;

  const metadata = await conn.groupMetadata(m.chat);
  const botId = conn.user?.id?.replace(/:\d+@/, '@');

  // Bot admin
  const isBotAdmin = metadata.participants.some(p => {
    const id = p.id?.replace(/:\d+/, '');
    return id === botId && p.admin;
  });

  // Sender admin
  const senderIds = [m.sender, m.lid]
    .filter(Boolean)
    .map(j => j.replace(/:\d+/, ''));

  const isSenderAdmin = metadata.participants.some(p => {
    const id = p.id?.replace(/:\d+/, '');
    return senderIds.includes(id) && p.admin;
  });

  // Admins y bot pueden enviar links
  if (isSenderAdmin || m.fromMe) return;

  // Permitir link del mismo grupo
  try {
    const code = await conn.groupInviteCode(m.chat);
    if (m.originalText.includes(`https://chat.whatsapp.com/${code}`)) return;
  } catch {}

  // Si no es admin, borrar mensaje
  if (!isBotAdmin) return;

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