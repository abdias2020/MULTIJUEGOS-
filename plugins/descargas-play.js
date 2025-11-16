// 🎧 Comando /play — LoliBot-MD (Actualizado)
import { ogmp3 } from '../lib/youtubedl.js';
import yts from 'yt-search';

const userRequests = {};
const TIMEOUT = 25000;
const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;

const handler = async (m, { conn, command, text, usedPrefix }) => {
  if (!text?.trim()) {
    return m.reply(
      `🎧 *¿Qué deseas buscar?*\n\n` +
      `💡 Ejemplos:\n` +
      `• ${usedPrefix + command} Lil New no me puedo enamorar\n` +
      `• ${usedPrefix + command} https://youtu.be/ejemplo\n\n` +
      `_Ingresa el nombre de la canción o enlace de YouTube_`
    );
  }

  if (userRequests[m.sender]) {
    return conn.reply(
      m.chat,
      `⏳ *Espera un momento* @${m.sender.split('@')[0]}\nYa tienes una descarga en curso.`,
      m,
      { mentions: [m.sender] }
    );
  }

  userRequests[m.sender] = true;

  try {
    const query = text.trim();
    const videoIdMatch = query.match(youtubeRegexID);
    const searchQuery = videoIdMatch ? `https://youtu.be/${videoIdMatch[1]}` : query;

    await m.reply('🔎 *Buscando en YouTube...*');

    const results = await yts(searchQuery);
    const video = results?.videos?.[0];
    if (!video) throw new Error(`No se encontró ningún resultado para: ${text}`);

    // 1️⃣ Enviar info del video
    await conn.sendMessage(m.chat, {
      text: 
        `🎶 *${video.title}*\n` +
        `📺 Canal: ${video.author.name}\n` +
        `⏱️ Duración: ${formatDuration(video.duration.seconds)}\n` +
        `👁️ Vistas: ${formatNumber(video.views)}\n` +
        `📅 Publicado: ${video.ago}\n\n` +
        `📥 Preparando descarga 🎵...`,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: video.author.name,
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: m });

    // 2️⃣ Mensaje tipo "Descargando..." (puedes reemplazar por sticker si quieres)
    await conn.sendMessage(m.chat, { text: `⬇️ *Descargando audio MP3...*` }, { quoted: m });

    // 3️⃣ Descargar audio usando ogmp3
    const audioData = await ogmp3.download(video.url, '320', 'audio');
    if (!audioData?.status || !audioData?.result?.download) {
      throw new Error(audioData?.error || 'No se pudo generar la descarga de audio');
    }

    const mediaUrl = audioData.result.download;

    // 4️⃣ Enviar audio final
    await conn.sendMessage(m.chat, {
      audio: { url: mediaUrl },
      mimetype: 'audio/mpeg',
      fileName: `${sanitizeFilename(video.title)}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: `${video.author.name} • MP3`,
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
          mediaType: 2
        }
      }
    }, { quoted: m });

    m.react('✅');

  } catch (err) {
    console.error('❌ Error crítico:', err.message);
    await m.reply(
      `🚫 *Error en la descarga*\n\n` +
      `📋 *Detalles:* ${err.message}\n` +
      `💡 Intenta otro video o enlace de YouTube`
    );
    m.react('❌');
  } finally {
    delete userRequests[m.sender];
  }
};

// ⚙️ Funciones auxiliares
function formatDuration(s) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatNumber(n) {
  return n ? n.toLocaleString('es-ES') : '0';
}

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, '-').substring(0, 180);
}

handler.command = ['play', 'musica', 'play3', 'audio'];
handler.help = ['play <canción>'];
handler.tags = ['downloader'];
handler.limit = false;

export default handler;