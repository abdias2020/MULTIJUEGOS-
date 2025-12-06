// 🎧 Comando /play — Búsqueda y descarga inteligente (CORREGIDO)
import { ogmp3 } from '../lib/youtubedl.js';
import yts from 'yt-search';
import fetch from 'node-fetch';
import axios from 'axios';

const userRequests = {};
const userSelections = {}; // Almacena las selecciones de usuarios
const TIMEOUT = 30000;
const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/;

// 📦 APIs para descargas de AUDIO (15 APIs)
const AudioAPIs = {
  ogmp3: async (url) => {
    const data = await ogmp3.download(url, '320', 'audio');
    if (data?.status && data?.result?.download) {
      return { url: data.result.download, source: 'ogmp3' };
    }
    throw new Error('ogmp3 falló');
  },

  siputzx: async (url) => {
    const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp3?url=${url}`);
    const { data } = await res.json();
    if (data?.dl) return { url: data.dl, source: 'siputzx' };
    throw new Error('siputzx falló');
  },

  agatz: async (url) => {
    const res = await fetch(`https://api.agatz.xyz/api/ytmp3?url=${url}`);
    const data = await res.json();
    if (data?.data?.downloadUrl) return { url: data.data.downloadUrl, source: 'agatz' };
    throw new Error('agatz falló');
  },

  zenkey: async (url) => {
    const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp3?apikey=zenkey&url=${url}`);
    const { result } = await res.json();
    if (result?.download?.url) return { url: result.download.url, source: 'zenkey' };
    throw new Error('zenkey falló');
  },

  cobalt: async (url) => {
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

  ytdlplus: async (url) => {
    const res = await fetch(`https://api.ytdlplus.com/download?url=${url}&format=mp3`);
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'ytdlplus' };
    throw new Error('ytdlplus falló');
  },

  y2mate: async (url) => {
    const res = await fetch(`https://api.y2mate.com/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, format: 'mp3' })
    });
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'y2mate' };
    throw new Error('y2mate falló');
  },

  savefrom: async (url) => {
    const res = await fetch(`https://api.savefrom.net/download?url=${url}`);
    const data = await res.json();
    if (data?.url && data?.url[0]?.url) return { url: data.url[0].url, source: 'savefrom' };
    throw new Error('savefrom falló');
  },

  ytmp3: async (url) => {
    const res = await fetch(`https://www.yt-download.org/api/button/mp3/${url}`);
    const data = await res.json();
    if (data?.dlink) return { url: data.dlink, source: 'ytmp3' };
    throw new Error('ytmp3 falló');
  },

  loader: async (url) => {
    const res = await fetch(`https://api.loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.download?.url) return { url: data.download.url, source: 'loader' };
    throw new Error('loader falló');
  },

  snapsave: async (url) => {
    const res = await fetch('https://snapsave.app/action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`
    });
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'snapsave' };
    throw new Error('snapsave falló');
  },

  ytbmp3: async (url) => {
    const res = await fetch(`https://api.ytbmp3.com/api/convert?url=${url}`);
    const data = await res.json();
    if (data?.download) return { url: data.download, source: 'ytbmp3' };
    throw new Error('ytbmp3 falló');
  },

  converto: async (url) => {
    const res = await fetch(`https://www.converto.io/api/convert`, {
      method: 'POST',
      body: JSON.stringify({ url: url }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data?.url) return { url: data.url, source: 'converto' };
    throw new Error('converto falló');
  },

  ytmate: async (url) => {
    const res = await fetch(`https://ytmate.app/api/convert?url=${url}&format=mp3`);
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'ytmate' };
    throw new Error('ytmate falló');
  },

  yt5s: async (url) => {
    const res = await fetch(`https://yt5s.com/api/ajaxConvert/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}&ftype=mp3`
    });
    const data = await res.json();
    if (data?.dlink) return { url: data.dlink, source: 'yt5s' };
    throw new Error('yt5s falló');
  }
};

// 📦 APIs para descargas de VIDEO (12 APIs)
const VideoAPIs = {
  ogmp3: async (url, quality = '720') => {
    const data = await ogmp3.download(url, quality, 'video');
    if (data?.status && data?.result?.download) {
      return { url: data.result.download, source: 'ogmp3-video' };
    }
    throw new Error('ogmp3 video falló');
  },

  siputzx: async (url) => {
    const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp4?url=${url}`);
    const { data } = await res.json();
    if (data?.dl) return { url: data.dl, source: 'siputzx-video' };
    throw new Error('siputzx video falló');
  },

  agatz: async (url) => {
    const res = await fetch(`https://api.agatz.xyz/api/ytmp4?url=${url}`);
    const data = await res.json();
    if (data?.data?.downloadUrl) return { url: data.data.downloadUrl, source: 'agatz-video' };
    throw new Error('agatz video falló');
  },

  zenkey: async (url) => {
    const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp4?apikey=zenkey&url=${url}`);
    const { result } = await res.json();
    if (result?.download?.url) return { url: result.download.url, source: 'zenkey-video' };
    throw new Error('zenkey video falló');
  },

  axeel: async (url) => {
    const res = await fetch(`https://axeel.my.id/api/download/video?url=${url}`);
    const json = await res.json();
    if (json?.downloads?.url) return { url: json.downloads.url, source: 'axeel' };
    throw new Error('axeel falló');
  },

  ytdlplus: async (url) => {
    const res = await fetch(`https://api.ytdlplus.com/download?url=${url}&format=mp4`);
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'ytdlplus-video' };
    throw new Error('ytdlplus video falló');
  },

  y2mate: async (url) => {
    const res = await fetch(`https://api.y2mate.com/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, format: 'mp4', quality: '720' })
    });
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'y2mate-video' };
    throw new Error('y2mate video falló');
  },

  savefrom: async (url) => {
    const res = await fetch(`https://api.savefrom.net/download?url=${url}`);
    const data = await res.json();
    const videoUrl = data?.url?.find(item => item.type === 'video')?.url;
    if (videoUrl) return { url: videoUrl, source: 'savefrom-video' };
    throw new Error('savefrom video falló');
  },

  loader: async (url) => {
    const res = await fetch(`https://api.loader.to/ajax/download.php?format=720&url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.download?.url) return { url: data.download.url, source: 'loader-video' };
    throw new Error('loader video falló');
  },

  snapsave: async (url) => {
    const res = await fetch('https://snapsave.app/action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`
    });
    const data = await res.json();
    const videoUrl = data?.table?.find(item => item.quality === '720p')?.url;
    if (videoUrl) return { url: videoUrl, source: 'snapsave-video' };
    throw new Error('snapsave video falló');
  },

  ytmate: async (url) => {
    const res = await fetch(`https://ytmate.app/api/convert?url=${url}&format=mp4`);
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'ytmate-video' };
    throw new Error('ytmate video falló');
  },

  yt5s: async (url) => {
    const res = await fetch(`https://yt5s.com/api/ajaxConvert/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}&ftype=mp4&fquality=720`
    });
    const data = await res.json();
    if (data?.dlink) return { url: data.dlink, source: 'yt5s-video' };
    throw new Error('yt5s video falló');
  }
};

// 🔄 Función de descarga con fallback
async function downloadWithFallback(url, apis) {
  for (const [name, apiFunc] of Object.entries(apis)) {
    try {
      console.log(`🔄 Intentando con API: ${name}`);
      const result = await Promise.race([
        apiFunc(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
        )
      ]);
      
      if (result?.url) {
        console.log(`✅ Descarga exitosa con: ${result.source}`);
        return result;
      }
    } catch (err) {
      console.log(`⚠️ API ${name} falló:`, err.message);
      continue;
    }
  }
  throw new Error('Todas las APIs fallaron');
}

const handler = async (m, { conn, command, text, usedPrefix }) => {
  const input = text?.trim().toLowerCase();
  
  // 🔍 VERIFICAR SI EL USUARIO ESTÁ RESPONDIENDO A UNA SELECCIÓN
  if (userSelections[m.sender]) {
    if (input === '1' || input === 'mp3' || input === 'audio') {
      return await downloadAudio(m, conn, userSelections[m.sender], usedPrefix);
    } else if (input === '2' || input === 'mp4' || input === 'video') {
      return await downloadVideo(m, conn, userSelections[m.sender], usedPrefix);
    } else {
      return m.reply(
        `❌ *Opción inválida*\n\n` +
        `Por favor responde con:\n` +
        `• *1* o *MP3* o *audio* para descargar audio\n` +
        `• *2* o *MP4* o *video* para descargar video\n\n` +
        `_Tienes 2 minutos para responder_`
      );
    }
  }

  // Validación de entrada para nueva búsqueda
  if (!text?.trim()) {
    return m.reply(
      `🎧 *¿Qué deseas buscar?*\n\n` +
      `💡 *Ejemplos:*\n` +
      `• ${usedPrefix + command} Bad Bunny - Monaco\n` +
      `• ${usedPrefix + command} The Weeknd Blinding Lights\n` +
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

    m.react('🔍');
    await m.reply('🔎 *Buscando en YouTube...*');

    // 🔍 Búsqueda en YouTube
    const results = await yts(searchQuery);
    const video = results?.videos?.[0];
    
    if (!video) {
      delete userRequests[m.sender];
      throw new Error(`No se encontró ningún resultado para: ${text}`);
    }

    // Guardar información del video para la selección del usuario
    userSelections[m.sender] = {
      video: video,
      timestamp: Date.now()
    };

    // Limpiar selecciones antiguas (más de 2 minutos)
    setTimeout(() => {
      if (userSelections[m.sender]?.timestamp === userSelections[m.sender]?.timestamp) {
        delete userSelections[m.sender];
        console.log(`⏰ Selección expirada para ${m.sender}`);
      }
    }, 120000);

    // Mostrar resultado y opciones
    const message = 
      `╭━━━『 *RESULTADO ENCONTRADO* 』━━━╮\n` +
      `│\n` +
      `│ 🎵 *Título:*\n` +
      `│    ${video.title}\n` +
      `│\n` +
      `│ 👤 *Canal:* ${video.author.name}\n` +
      `│ ⏱️ *Duración:* ${video.timestamp}\n` +
      `│ 👁️ *Vistas:* ${formatNumber(video.views)}\n` +
      `│ 📅 *Publicado:* ${video.ago}\n` +
      `│\n` +
      `│ 🔗 *URL:* ${video.url}\n` +
      `│\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
      `┌──────────────────────────\n` +
      `│ *¿CÓMO DESEAS DESCARGARLO?*\n` +
      `│\n` +
      `│ 🎵 Responde *1* o *MP3* para:\n` +
      `│    → Solo audio (música)\n` +
      `│\n` +
      `│ 🎬 Responde *2* o *MP4* para:\n` +
      `│    → Video completo\n` +
      `│\n` +
      `└──────────────────────────\n\n` +
      `_⏰ Tienes 2 minutos para responder_`;

    await conn.sendMessage(m.chat, {
      image: { url: video.thumbnail },
      caption: message,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: `${video.author.name} • ${video.timestamp}`,
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
          mediaType: 1,
          renderLargerThumbnail: true
        }
      }
    }, { quoted: m });

    m.react('✅');

  } catch (err) {
    console.error('❌ Error crítico:', err.message);
    await m.reply(
      `🚫 *Error en la búsqueda*\n\n` +
      `📋 *Detalles:* ${err.message}\n\n` +
      `💡 *Soluciones:*\n` +
      `• Verifica el nombre de la canción\n` +
      `• Intenta con otros términos de búsqueda\n` +
      `• Usa un enlace directo de YouTube\n\n` +
      `_Si persiste, reporta al desarrollador_`
    );
    m.react('❌');
  } finally {
    delete userRequests[m.sender];
  }
};

// 🎵 Función para descargar AUDIO
async function downloadAudio(m, conn, selection, usedPrefix) {
  const { video } = selection;
  
  if (userRequests[m.sender]) {
    return m.reply('⏳ Espera, ya hay una descarga en curso...');
  }

  userRequests[m.sender] = true;
  delete userSelections[m.sender];

  try {
    m.react('⬇️');
    await m.reply('⬇️ *Descargando audio MP3...*\n_Esto puede tardar unos segundos_');

    const result = await downloadWithFallback(video.url, AudioAPIs);

    await conn.sendMessage(m.chat, {
      audio: { url: result.url },
      mimetype: 'audio/mpeg',
      fileName: `${sanitizeFilename(video.title)}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: video.title,
          body: `${video.author.name} • MP3 (${result.source})`,
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
          mediaType: 2
        }
      }
    }, { quoted: m });

    m.react('✅');

  } catch (err) {
    console.error('❌ Error en descarga de audio:', err);
    await m.reply(
      `🚫 *Error al descargar audio*\n\n` +
      `📋 ${err.message}\n\n` +
      `💡 Intenta con:\n` +
      `• ${usedPrefix}ytmp3 ${video.url}\n` +
      `• Otro video diferente`
    );
    m.react('❌');
  } finally {
    delete userRequests[m.sender];
  }
}

// 🎬 Función para descargar VIDEO
async function downloadVideo(m, conn, selection, usedPrefix) {
  const { video } = selection;
  
  if (userRequests[m.sender]) {
    return m.reply('⏳ Espera, ya hay una descarga en curso...');
  }

  userRequests[m.sender] = true;
  delete userSelections[m.sender];

  try {
    m.react('⬇️');
    await m.reply('⬇️ *Descargando video MP4...*\n_Esto puede tardar un poco más_');

    const result = await downloadWithFallback(video.url, VideoAPIs);

    await conn.sendMessage(m.chat, {
      video: { url: result.url },
      mimetype: 'video/mp4',
      fileName: `${sanitizeFilename(video.title)}.mp4`,
      caption: 
        `🎬 *${video.title}*\n\n` +
        `👤 *Canal:* ${video.author.name}\n` +
        `⏱️ *Duración:* ${video.timestamp}\n` +
        `⚙️ *Descargado con:* ${result.source}`,
      thumbnail: video.thumbnail
    }, { quoted: m });

    m.react('✅');

  } catch (err) {
    console.error('❌ Error en descarga de video:', err);
    await m.reply(
      `🚫 *Error al descargar video*\n\n` +
      `📋 ${err.message}\n\n` +
      `💡 Intenta con:\n` +
      `• ${usedPrefix}ytmp4 ${video.url}\n` +
      `• Otro video diferente`
    );
    m.react('❌');
  } finally {
    delete userRequests[m.sender];
  }
}

// ⚙️ Funciones auxiliares
function formatNumber(n) {
  if (!n) return '0';
  const num = parseInt(n.toString().replace(/\D/g, ''));
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString('es-ES');
}

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, '-').substring(0, 180);
}

handler.command = ['play', 'musica', 'play3', 'audio'];
handler.help = ['play <canción>'];
handler.tags = ['downloader'];
handler.limit = false;

export default handler;