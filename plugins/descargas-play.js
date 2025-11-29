// 🎧 Comando /play — LoliBot-MD (Mejorado con múltiples APIs)
import { ogmp3 } from '../lib/youtubedl.js';
import yts from 'yt-search';
import fetch from 'node-fetch';

const userRequests = {};
const TIMEOUT = 25000;
const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;

// 📦 APIs de respaldo para descargas
const APIs = {
  // API 1: ogmp3 (principal)
  ogmp3: async (url) => {
    const data = await ogmp3.download(url, '320', 'audio');
    if (data?.status && data?.result?.download) {
      return { url: data.result.download, source: 'ogmp3' };
    }
    throw new Error('ogmp3 falló');
  },

  // API 2: yt-dlp style API
  ytdlp: async (url) => {
    const response = await fetch(`https://api.cobalt.tools/api/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        vQuality: 'max',
        aFormat: 'mp3',
        filenamePattern: 'basic'
      })
    });
    const data = await response.json();
    if (data?.status === 'success' && data?.url) {
      return { url: data.url, source: 'cobalt' };
    }
    throw new Error('cobalt falló');
  },

  // API 3: ytdl-core alternative
  ytdlCore: async (url) => {
    const videoId = url.match(youtubeRegexID)?.[1];
    if (!videoId) throw new Error('ID inválido');
    
    const apiUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      // Aquí iría la lógica de extracción de URL de audio
      // Este es un ejemplo simplificado
      throw new Error('ytdl-core no disponible');
    }
    throw new Error('ytdl-core falló');
  },

  // API 4: Descarga directa con yt-search
  ytSearch: async (url) => {
    const videoId = url.match(youtubeRegexID)?.[1];
    if (!videoId) throw new Error('ID inválido');
    
    // Intenta usar una API pública genérica
    const apiUrl = `https://api.vevioz.com/api/button/mp3/${videoId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data?.status && data?.url) {
      return { url: data.url, source: 'vevioz' };
    }
    throw new Error('vevioz falló');
  },

  // API 5: Respaldo final con API genérica
  generic: async (url) => {
    const videoId = url.match(youtubeRegexID)?.[1];
    if (!videoId) throw new Error('ID inválido');
    
    // API de respaldo genérica
    const apiUrl = `https://api.downloadgram.org/LKSe8/${videoId}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data?.download_url) {
      return { url: data.download_url, source: 'generic' };
    }
    throw new Error('generic falló');
  }
};

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

    // 🔍 Búsqueda en YouTube
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

    // 2️⃣ Mensaje de descarga
    await conn.sendMessage(m.chat, { text: `⬇️ *Descargando audio MP3...*` }, { quoted: m });

    // 3️⃣ Intentar descargar con múltiples APIs (con fallback automático)
    let audioUrl = null;
    let usedApi = null;
    const apiList = ['ogmp3', 'ytdlp', 'ytSearch', 'generic'];
    
    for (const apiName of apiList) {
      try {
        console.log(`🔄 Intentando con API: ${apiName}`);
        const result = await Promise.race([
          APIs[apiName](video.url),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
          )
        ]);
        
        audioUrl = result.url;
        usedApi = result.source;
        console.log(`✅ Descarga exitosa con: ${usedApi}`);
        break;
      } catch (err) {
        console.log(`⚠️ API ${apiName} falló:`, err.message);
        continue;
      }
    }

    if (!audioUrl) {
      throw new Error('Todas las APIs fallaron. Intenta más tarde.');
    }

    // 4️⃣ Enviar audio final
    await conn.sendMessage(m.chat, {
      audio: { url: audioUrl },
      mimetype: 'audio/mpeg',
      fileName: `${sanitizeFilename(video.title)}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: `${video.author.name} • MP3 (${usedApi})`,
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
      `💡 Intenta otro video o enlace de YouTube\n` +
      `⚙️ Si persiste, reporta al desarrollador`
    );
    m.react('❌');
  } finally {
    delete userRequests[m.sender];
  }
};

// ⚙️ Funciones auxiliares
function formatDuration(s) {
  if (!s) return '0:00';
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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