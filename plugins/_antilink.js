import { db } from '../lib/postgres.js';

// Detecta TODOS los tipos de links posibles
const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/channel\/[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)[^\s]*)/gi;

// Detecta también dominios sin protocolo (ej: "google.com", "ejemplo.net")
const domainRegex = /\b[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)\b/gi;

export async function before(m, { conn }) {
  if (!m.isGroup) return;
  
  // Obtener el texto del mensaje de múltiples fuentes
  const messageText = m.originalText || m.text || m.message?.conversation || 
                      m.message?.extendedTextMessage?.text || '';
  
  if (!messageText) return;

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
    console.error('Error al verificar antilink:', e);
    return;
  }

  // Detectar CUALQUIER tipo de link
  const hasLink = linkRegex.test(messageText) || domainRegex.test(messageText);
  
  if (!hasLink) return;

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

  // Si el bot no es admin, solo advertir
  if (!isBotAdmin) {
    await conn.reply(
      m.chat,
      `⚠️ *ANTILINK ACTIVADO*\n\n@${participant.split('@')[0]} envió un link pero no puedo eliminarlo porque no soy administrador.\n\n🚫 *Links prohibidos en este grupo*`,
      m,
      { mentions: [participant] }
    );
    return;
  }

  // Borrar el mensaje automáticamente
  try {
    await conn.sendMessage(m.chat, {
      delete: {
        remoteJid: m.chat,
        fromMe: false,
        id: messageId,
        participant
      }
    });

    // Enviar advertencia (opcional, puedes comentar estas líneas si no quieres notificación)
    await conn.reply(
      m.chat,
      `🚫 *LINK ELIMINADO*\n\n@${participant.split('@')[0]} intentó enviar un link.\n\n⚠️ *Los links están prohibidos en este grupo*`,
      m,
      { mentions: [participant] }
    );
  } catch (err) {
    console.error('Error al eliminar mensaje:', err);
    
    // Si falla el borrado, notificar
    await conn.reply(
      m.chat,
      `⚠️ *ERROR*\n\nNo pude eliminar el link de @${participant.split('@')[0]}\n\nVerifica que tenga los permisos correctos.`,
      m,
      { mentions: [participant] }
    );
  }
}