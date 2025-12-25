import { db } from '../lib/postgres.js';

// Detecta TODOS los tipos de links posibles
const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|whatsapp\.com\/channel\/[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)[^\s]*)/gi;

// Detecta también dominios sin protocolo (ej: "google.com", "ejemplo.net")
const domainRegex = /\b[a-zA-Z0-9-]+\.(com|net|org|io|co|me|tv|app|gg|xyz|link|site|online|store|tech|info|biz|dev|pro|club|top|life|world|fun|space|click|live|today|uno|lat|ar|mx|es|us|uk|br|de|fr|it|ru|jp|cn|in)\b/gi;

export async function before(m, { conn }) {
  // Solo procesar mensajes de grupos
  if (!m.isGroup) return;
  
  // Ignorar mensajes del bot
  if (m.fromMe) return;
  
  // Obtener el texto del mensaje de múltiples fuentes
  const messageText = m.text || 
                      m.message?.conversation || 
                      m.message?.extendedTextMessage?.text || 
                      m.message?.imageMessage?.caption ||
                      m.message?.videoMessage?.caption ||
                      '';
  
  if (!messageText) return;

  // IDs importantes
  const groupId = m.chat;
  const messageId = m.key.id;
  const senderId = m.sender;
  const participant = m.key.participant || m.sender;

  // 1️⃣ Verificar si antilink está activo
  let antilinkActive = false;
  try {
    const res = await db.query(
      'SELECT antilink FROM group_settings WHERE group_id = $1',
      [groupId]
    );
    antilinkActive = res.rows[0]?.antilink || false;
  } catch (e) {
    console.error('❌ Error verificando antilink:', e.message);
    return;
  }

  if (!antilinkActive) return;

  // 2️⃣ Detectar CUALQUIER tipo de link
  const hasLink = linkRegex.test(messageText) || domainRegex.test(messageText);
  
  if (!hasLink) return;

  console.log(`🔗 Link detectado en ${groupId} por ${senderId}`);

  // 3️⃣ Obtener metadata del grupo
  let metadata;
  try {
    metadata = await conn.groupMetadata(groupId);
  } catch (e) {
    console.error('❌ Error obteniendo metadata del grupo:', e.message);
    return;
  }

  // 4️⃣ Verificar si el BOT es administrador
  const botNumber = conn.user.id.replace(/:\d+@s\.whatsapp\.net/, '');
  const botJid = botNumber.includes('@') ? botNumber : `${botNumber}@s.whatsapp.net`;
  
  const isBotAdmin = metadata.participants.some(p => {
    const pId = p.id.replace(/:\d+@s\.whatsapp\.net/, '@s.whatsapp.net');
    const normalizedBotJid = botJid.replace(/:\d+@s\.whatsapp\.net/, '@s.whatsapp.net');
    return pId === normalizedBotJid && (p.admin === 'admin' || p.admin === 'superadmin');
  });

  console.log(`🤖 Bot es admin: ${isBotAdmin}`);

  // 5️⃣ Verificar si el REMITENTE es administrador
  const normalizedSender = senderId.replace(/:\d+@s\.whatsapp\.net/, '@s.whatsapp.net');
  
  const isSenderAdmin = metadata.participants.some(p => {
    const pId = p.id.replace(/:\d+@s\.whatsapp\.net/, '@s.whatsapp.net');
    return pId === normalizedSender && (p.admin === 'admin' || p.admin === 'superadmin');
  });

  console.log(`👤 Remitente es admin: ${isSenderAdmin}`);

  // 6️⃣ Si el remitente es admin, permitir el link
  if (isSenderAdmin) {
    console.log('✅ Admin detectado, link permitido');
    return;
  }

  // 7️⃣ Si el bot NO es admin, solo advertir
  if (!isBotAdmin) {
    console.log('⚠️ Bot no es admin, solo advirtiendo');
    await conn.sendMessage(groupId, {
      text: `⚠️ *ANTILINK ACTIVADO*\n\n@${senderId.split('@')[0]} envió un link pero no puedo eliminarlo porque no soy administrador.\n\n🚫 *Links prohibidos en este grupo*`,
      mentions: [senderId]
    });
    return;
  }

  // 8️⃣ ELIMINAR EL MENSAJE (el bot ES admin y el remitente NO es admin)
  console.log('🗑️ Intentando eliminar mensaje...');

  try {
    // Método principal de eliminación
    await conn.sendMessage(groupId, {
      delete: {
        remoteJid: groupId,
        fromMe: false,
        id: messageId,
        participant: participant
      }
    });

    console.log('✅ Mensaje eliminado exitosamente');

    // Esperar un momento antes de enviar la advertencia
    await new Promise(resolve => setTimeout(resolve, 500));

    // Enviar advertencia silenciosa (sin quoted para evitar referencias al mensaje borrado)
    await conn.sendMessage(groupId, {
      text: `🚫 *LINK ELIMINADO*\n\n@${senderId.split('@')[0]} intentó enviar un link.\n\n⚠️ *Los links están prohibidos en este grupo*`,
      mentions: [senderId]
    });

  } catch (error) {
    console.error('❌ Error al eliminar mensaje:', error.message);
    console.error('Stack:', error.stack);

    // Intentar método alternativo
    try {
      console.log('🔄 Intentando método alternativo...');
      
      await conn.sendMessage(groupId, {
        delete: {
          remoteJid: groupId,
          id: messageId,
          participant: senderId,
          fromMe: false
        }
      });

      console.log('✅ Mensaje eliminado con método alternativo');

      await conn.sendMessage(groupId, {
        text: `🚫 *LINK ELIMINADO*\n\n@${senderId.split('@')[0]} intentó enviar un link.\n\n⚠️ *Los links están prohibidos en este grupo*`,
        mentions: [senderId]
      });

    } catch (error2) {
      console.error('❌ Método alternativo también falló:', error2.message);
      
      // Último intento: notificar que no se pudo eliminar
      await conn.sendMessage(groupId, {
        text: `⚠️ *ERROR AL ELIMINAR LINK*\n\n@${senderId.split('@')[0]} envió un link pero ocurrió un error al eliminarlo.\n\n📋 *Detalles técnicos:*\n${error2.message}\n\n🔧 Verifica que el bot tenga permisos de administrador correctos.`,
        mentions: [senderId]
      });
    }
  }
}