// 🔍 Sistema de búsqueda de YouTube mejorado
import yts from 'yt-search';

const handler = async (m, { conn, usedPrefix, text, args, command }) => {
  // Validación de entrada
  if (!text?.trim()) {
    return m.reply(
      `*🔎 ¿Qué deseas buscar?*\n\n` +
      `💡 *Ejemplos:*\n` +
      `• ${usedPrefix + command} Bad Bunny\n` +
      `• ${usedPrefix + command} Lil Nas X Industry Baby\n` +
      `• ${usedPrefix + command} Shakira Sessions 53\n\n` +
      `_Ingresa el nombre de la canción o artista_`
    );
  }

  m.react('🔍');

  try {
    // 🔍 Búsqueda en YouTube
    const result = await yts(text.trim());
    const ytres = result.videos;

    if (!ytres || ytres.length === 0) {
      m.react('❌');
      return m.reply(`❌ *No se encontraron resultados para:* "${text}"\n\n💡 Intenta con otros términos de búsqueda`);
    }

    // Guardar URLs en lista global para uso con comandos ytmp3/ytmp4
    if (!global.videoList) global.videoList = [];
    
    // Limpiar entradas antiguas del mismo usuario
    global.videoList = global.videoList.filter(item => item.from !== m.sender);
    
    // Agregar nueva lista de URLs
    global.videoList.push({
      from: m.sender,
      urls: ytres.slice(0, 15).map(v => v.url),
      timestamp: Date.now()
    });

    // Limpiar listas antiguas (más de 5 minutos)
    global.videoList = global.videoList.filter(
      item => Date.now() - item.timestamp < 300000
    );

    // 📝 Construir mensaje con resultados
    let textoo = `╭━━━『 *RESULTADOS DE BÚSQUEDA* 』━━━╮\n`;
    textoo += `│\n`;
    textoo += `│ 🔎 *Búsqueda:* ${text}\n`;
    textoo += `│ 📊 *Resultados encontrados:* ${ytres.length}\n`;
    textoo += `│ 🎯 *Mostrando:* ${Math.min(15, ytres.length)} videos\n`;
    textoo += `│\n`;
    textoo += `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    // Agregar hasta 15 resultados
    const maxResults = Math.min(15, ytres.length);
    
    for (let i = 0; i < maxResults; i++) {
      const v = ytres[i];
      const num = i + 1;
      
      textoo += `╭─────────────────\n`;
      textoo += `│ 🔢 *#${num}*\n`;
      textoo += `│ 🎵 *Título:*\n│    ${v.title}\n`;
      textoo += `│\n`;
      textoo += `│ 👤 *Canal:* ${v.author.name}\n`;
      textoo += `│ ⏱️ *Duración:* ${v.timestamp}\n`;
      textoo += `│ 👁️ *Vistas:* ${formatViews(v.views)}\n`;
      textoo += `│ 📅 *Publicado:* ${v.ago}\n`;
      textoo += `│\n`;
      textoo += `│ 🔗 *URL:* ${v.url}\n`;
      textoo += `╰─────────────────\n\n`;
    }

    // Agregar instrucciones de uso
    textoo += `╭━━━『 *CÓMO DESCARGAR* 』━━━╮\n`;
    textoo += `│\n`;
    textoo += `│ 🎵 *Para Audio:*\n`;
    textoo += `│    ${usedPrefix}ytmp3 [número]\n`;
    textoo += `│    Ejemplo: ${usedPrefix}ytmp3 1\n`;
    textoo += `│\n`;
    textoo += `│ 🎬 *Para Video:*\n`;
    textoo += `│    ${usedPrefix}ytmp4 [número]\n`;
    textoo += `│    Ejemplo: ${usedPrefix}ytmp4 1\n`;
    textoo += `│\n`;
    textoo += `│ 💡 *También puedes usar el enlace directo*\n`;
    textoo += `│\n`;
    textoo += `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
    textoo += `_⏰ Esta lista expira en 5 minutos_`;

    // Enviar resultados con thumbnail del primer video
    await conn.sendMessage(m.chat, {
      image: { url: ytres[0].thumbnail || ytres[0].image },
      caption: textoo,
      contextInfo: {
        externalAdReply: {
          title: `📋 ${maxResults} Resultados encontrados`,
          body: `Búsqueda: ${text}`,
          thumbnailUrl: ytres[0].thumbnail || ytres[0].image,
          sourceUrl: ytres[0].url,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: m });

    m.react('✅');

  } catch (error) {
    console.error('❌ Error en búsqueda de YouTube:', error);
    m.react('❌');
    return m.reply(
      `🚫 *Error al buscar en YouTube*\n\n` +
      `📋 *Detalles:* ${error.message}\n\n` +
      `💡 *Soluciones:*\n` +
      `• Verifica tu conexión a internet\n` +
      `• Intenta con otros términos de búsqueda\n` +
      `• Espera unos segundos y vuelve a intentar\n\n` +
      `_Si el problema persiste, contacta al desarrollador_`
    );
  }
};

// ⚙️ Función para formatear vistas
function formatViews(views) {
  if (!views) return '0';
  
  const num = parseInt(views.toString().replace(/\D/g, ''));
  
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  
  return num.toLocaleString('es-ES');
}

// 📝 Configuración del comando
handler.help = ['ytsearch <búsqueda>'];
handler.tags = ['downloader'];
handler.command = ['playvid2', 'playlist', 'playlista', 'yts', 'ytsearch'];
handler.register = true;

export default handler;


/*
╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮
│                                                                      
│  📋 CÓDIGO CON LISTAS INTERACTIVAS (OPCIONAL)
│  
│  Este código usa sendList() para WhatsApp
│  Si tu bot no soporta listas, usa el código principal
│                                                                      
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

import yts from 'yt-search';

const handler = async (m, { conn, usedPrefix, text, args, command }) => {
  if (!text?.trim()) {
    return m.reply(
      `*🔎 ¿Qué deseas buscar?*\n\n` +
      `💡 *Ejemplo:* ${usedPrefix + command} bad bunny`
    );
  }

  m.react('📀');

  try {
    const result = await yts(text.trim());
    const ytres = result.videos;

    if (!ytres || ytres.length === 0) {
      m.react('❌');
      return m.reply(`❌ No se encontraron resultados para: "${text}"`);
    }

    // Construir secciones de lista interactiva
    let listSections = [];
    const maxResults = Math.min(10, ytres.length);

    for (let i = 0; i < maxResults; i++) {
      const v = ytres[i];
      const num = i + 1;

      listSections.push({
        title: `${num}. ${v.title.substring(0, 60)}`,
        rows: [
          {
            header: '🎵 DESCARGAR AUDIO',
            title: 'MP3',
            description: `⏱️ ${v.timestamp} | 👁️ ${formatViews(v.views)}\n📅 ${v.ago} | 👤 ${v.author.name}`,
            id: `${usedPrefix}ytmp3 ${v.url}`
          },
          {
            header: '🎬 DESCARGAR VIDEO',
            title: 'MP4',
            description: `⏱️ ${v.timestamp} | 👁️ ${formatViews(v.views)}\n📅 ${v.ago} | 👤 ${v.author.name}`,
            id: `${usedPrefix}ytmp4 ${v.url}`
          },
          {
            header: '📄 AUDIO COMO DOCUMENTO',
            title: 'MP3 Doc',
            description: `⏱️ ${v.timestamp} | 👁️ ${formatViews(v.views)}`,
            id: `${usedPrefix}ytmp3doc ${v.url}`
          },
          {
            header: '📁 VIDEO COMO DOCUMENTO',
            title: 'MP4 Doc',
            description: `⏱️ ${v.timestamp} | 👁️ ${formatViews(v.views)}`,
            id: `${usedPrefix}ytmp4doc ${v.url}`
          }
        ]
      });
    }

    // Enviar lista interactiva
    await conn.sendList(
      m.chat,
      `*🔍 RESULTADOS: ${text}*\n\n` +
      `📊 Se encontraron ${ytres.length} videos\n` +
      `🎯 Mostrando los primeros ${maxResults}\n\n` +
      `> *Elige una opción y presiona enviar*`,
      'YouTube Search Results',
      `🚀 VER RESULTADOS 🚀`,
      ytres[0].thumbnail || ytres[0].image,
      listSections,
      m
    );

    m.react('✅');

  } catch (error) {
    console.error('❌ Error en búsqueda:', error);
    m.react('❌');
    return m.reply(`🚫 Error al buscar: ${error.message}`);
  }
};

function formatViews(views) {
  if (!views) return '0';
  const num = parseInt(views.toString().replace(/\D/g, ''));
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString('es-ES');
}

handler.help = ['ytsearch <búsqueda>'];
handler.tags = ['downloader'];
handler.command = ['playvid2', 'playlist', 'playlista', 'yts', 'ytsearch'];
handler.register = true;

export default handler;
*/