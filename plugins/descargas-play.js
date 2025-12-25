// 🎧 Comando /play — Búsqueda y descarga inteligente (ACTUALIZADO 2025)
import { ogmp3 } from '../lib/youtubedl.js';
import { savetube } from '../lib/yt-savetube.js';
import { amdl, ytdown } from '../lib/scraper.js';
import yts from 'yt-search';
import fetch from 'node-fetch';
import axios from 'axios';

const userRequests = {};
const userSelections = {}; // Almacena las selecciones de usuarios
const TIMEOUT = 35000;
const youtubeRegexID = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/;

// 📦 APIs para descargas de AUDIO (18 APIs con prioridad actualizada)
const AudioAPIs = {
  // 🔥 APIs PREMIUM (Prioridad 1)
  savetube_mp3: async (url) => {
    const data = await savetube.download(url, 'mp3');
    if (!data.status) throw new Error(data.error);
    return { 
      url: data.result.download, 
      source: 'SaveTube MP3',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      duration: data.result.duration
    };
  },

  savetube_m4a: async (url) => {
    const data = await savetube.download(url, 'm4a');
    if (!data.status) throw new Error(data.error);
    return { 
      url: data.result.download, 
      source: 'SaveTube M4A',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      duration: data.result.duration
    };
  },

  ogmp3_320: async (url) => {
    const data = await ogmp3.download(url, '320', 'audio');
    if (!data?.status || !data?.result?.download) throw new Error('ogmp3 falló');
    return { 
      url: data.result.download, 
      source: 'OGMp3 320kbps',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      quality: data.result.quality
    };
  },

  ogmp3_256: async (url) => {
    const data = await ogmp3.download(url, '256', 'audio');
    if (!data?.status || !data?.result?.download) throw new Error('ogmp3 256 falló');
    return { 
      url: data.result.download, 
      source: 'OGMp3 256kbps',
      title: data.result.title
    };
  },

  amdl_audio: async (url) => {
    const response = await amdl.download(url, '720p');
    const { title, download } = response.result;
    return { url: download, source: 'AMDL', title };
  },

  ytdown_audio: async (url) => {
    const response = await ytdown.download(url, 'mp3');
    return { 
      url: response.download, 
      source: 'YTDown',
      title: response.title 
    };
  },

  // 🌐 APIs de respaldo
  siputzx: async (url) => {
    const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`);
    const { data } = await res.json();
    if (data?.dl) return { url: data.dl, source: 'SiputZX' };
    throw new Error('siputzx falló');
  },

  agatz: async (url) => {
    const res = await fetch(`https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.data?.downloadUrl) return { url: data.data.downloadUrl, source: 'Agatz' };
    throw new Error('agatz falló');
  },

  zenkey: async (url) => {
    const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp3?apikey=zenkey&url=${encodeURIComponent(url)}`);
    const { result } = await res.json();
    if (result?.download?.url) return { url: result.download.url, source: 'ZenKey' };
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
      return { url: data.url, source: 'Cobalt' };
    }
    throw new Error('cobalt falló');
  },

  y2mate: async (url) => {
    const res = await fetch(`https://api-y2mate.com/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, format: 'mp3', quality: '320' })
    });
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'Y2Mate' };
    throw new Error('y2mate falló');
  },

  savefrom: async (url) => {
    const res = await fetch(`https://api.savefrom.net/download?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    const audioUrl = data?.url?.find(item => item.type === 'audio')?.url;
    if (audioUrl) return { url: audioUrl, source: 'SaveFrom' };
    throw new Error('savefrom falló');
  },

  loader: async (url) => {
    const res = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.download?.url) return { url: data.download.url, source: 'Loader' };
    throw new Error('loader falló');
  },

  snapsave: async (url) => {
    const res = await fetch('https://snapsave.app/action.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`
    });
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'SnapSave' };
    throw new Error('snapsave falló');
  },

  ytbmp3: async (url) => {
    const res = await fetch(`https://ytbmp3.com/api/convert?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.download) return { url: data.download, source: 'YTBmp3' };
    throw new Error('ytbmp3 falló');
  },

  converto: async (url) => {
    const res = await fetch(`https://converto.io/api/convert`, {
      method: 'POST',
      body: JSON.stringify({ url: url }),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data?.url) return { url: data.url, source: 'Converto' };
    throw new Error('converto falló');
  },

  ytmate: async (url) => {
    const res = await fetch(`https://ytmate.app/api/convert?url=${encodeURIComponent(url)}&format=mp3`);
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'YTMate' };
    throw new Error('ytmate falló');
  },

  yt5s: async (url) => {
    const res = await fetch(`https://yt5s.com/api/ajaxConvert/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}&ftype=mp3&fquality=320`
    });
    const data = await res.json();
    if (data?.dlink) return { url: data.dlink, source: 'YT5s' };
    throw new Error('yt5s falló');
  }
};

// 📦 APIs para descargas de VIDEO (15 APIs con prioridad actualizada)
const VideoAPIs = {
  // 🔥 APIs PREMIUM (Prioridad 1)
  savetube_720: async (url) => {
    const data = await savetube.download(url, '720');
    if (!data.status) throw new Error(data.error);
    return { 
      url: data.result.download, 
      source: 'SaveTube 720p',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      duration: data.result.duration,
      quality: '720p'
    };
  },

  savetube_480: async (url) => {
    const data = await savetube.download(url, '480');
    if (!data.status) throw new Error(data.error);
    return { 
      url: data.result.download, 
      source: 'SaveTube 480p',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      quality: '480p'
    };
  },

  savetube_360: async (url) => {
    const data = await savetube.download(url, '360');
    if (!data.status) throw new Error(data.error);
    return { 
      url: data.result.download, 
      source: 'SaveTube 360p',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      quality: '360p'
    };
  },

  ogmp3_720: async (url) => {
    const data = await ogmp3.download(url, '720', 'video');
    if (!data?.status || !data?.result?.download) throw new Error('ogmp3 video falló');
    return { 
      url: data.result.download, 
      source: 'OGMp3 720p',
      title: data.result.title,
      thumbnail: data.result.thumbnail,
      quality: '720p'
    };
  },

  ogmp3_480: async (url) => {
    const data = await ogmp3.download(url, '480', 'video');
    if (!data?.status || !data?.result?.download) throw new Error('ogmp3 480p falló');
    return { 
      url: data.result.download, 
      source: 'OGMp3 480p',
      quality: '480p'
    };
  },

  amdl_video: async (url) => {
    const response = await amdl.download(url, '720p');
    const { title, download, thumbnail } = response.result;
    return { url: download, source: 'AMDL 720p', title, thumbnail };
  },

  ytdown_video: async (url) => {
    const response = await ytdown.download(url, 'mp4');
    return { 
      url: response.download, 
      source: 'YTDown',
      title: response.title,
      thumbnail: response.thumbnail 
    };
  },

  // 🌐 APIs de respaldo
  siputzx: async (url) => {
    const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`);
    const { data } = await res.json();
    if (data?.dl) return { url: data.dl, source: 'SiputZX Video' };
    throw new Error('siputzx video falló');
  },

  agatz: async (url) => {
    const res = await fetch(`https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.data?.downloadUrl) return { url: data.data.downloadUrl, source: 'Agatz Video' };
    throw new Error('agatz video falló');
  },

  zenkey: async (url) => {
    const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp4?apikey=zenkey&url=${encodeURIComponent(url)}`);
    const { result } = await res.json();
    if (result?.download?.url) return { url: result.download.url, source: 'ZenKey Video' };
    throw new Error('zenkey video falló');
  },

  axeel: async (url) => {
    const res = await fetch(`https://axeel.my.id/api/download/video?url=${encodeURIComponent(url)}`);
    const json = await res.json();
    if (json?.downloads?.url) return { url: json.downloads.url, source: 'Axeel' };
    throw new Error('axeel falló');
  },

  y2mate: async (url) => {
    const res = await fetch(`https://api-y2mate.com/api/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url, format: 'mp4', quality: '720' })
    });
    const data = await res.json();
    if (data?.downloadUrl) return { url: data.downloadUrl, source: 'Y2Mate Video' };
    throw new Error('y2mate video falló');
  },

  savefrom: async (url) => {
    const res = await fetch(`https://api.savefrom.net/download?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    const videoUrl = data?.url?.find(item => item.type === 'video' && item.quality === '720p')?.url;
    if (videoUrl) return { url: videoUrl, source: 'SaveFrom Video' };
    throw new Error('savefrom video falló');
  },

  loader: async (url) => {
    const res = await fetch(`https://loader.to/ajax/download.php?format=720&url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data?.download?.url) return { url: data.download.url, source: 'Loader Video' };
    throw new Error('loader video falló');
  },

  yt5s: async (url) => {
    const res = await fetch(`https://yt5s.com/api/ajaxConvert/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}&ftype=mp4&fquality=720`
    });
    const data = await res.json();
    if (data?.dlink) return { url: data.dlink, source: 'YT5s Video' };
    throw new Error('yt5s video falló');
  }
};

// 🔄 Función de descarga con fallback inteligente
async function downloadWithFallback(url, apis) {
  const errors = [];
  
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
      errors.push(`${name}: ${err.message}`);
      continue;
    }
  }
  
  throw new Error(`Todas las APIs fallaron:\n${errors.slice(0, 3).join('\n')}`);
}

// 📋 Obtener información del video usando SaveTube primero
async function getVideoInfo(url) {
  try {
    // Intentar con SaveTube primero (más completo)
    const formats = await savetube.getAllFormats(url);
    if (formats.status) {
      return {
        title: formats.result.title,
        author: formats.result.author,
        duration: formats.result.duration,
        durationSeconds: formats.result.durationSeconds,
        thumbnail: formats.result.thumbnail,
        url: url,
        videoId: formats.result.videoId
      };
    }
  } catch (err) {
    console.log('⚠️ SaveTube info falló, usando yts');
  }

  // Fallback con yts
  const search = await yts(url);
  const video = search?.videos?.[0];
  if (video) {
    return {
      title: video.title,
      author: video.author.name,
      duration: video.timestamp,
      views: video.views,
      thumbnail: video.thumbnail,
      url: video.url,
      videoId: video.videoId
    };
  }
  
  return null;
}

// Handler principal
const handler = async (m, { conn, command, text, usedPrefix }) => {
  const messageText = text || m.text || '';
  const input = messageText.trim().toLowerCase();
  
  console.log(`📨 Mensaje recibido de ${m.sender}: "${messageText}"`);
  console.log(`🔍 Usuario tiene selección pendiente: ${!!userSelections[m.sender]}`);
  
  // 🔍 VERIFICAR SI EL USUARIO ESTÁ RESPONDIENDO A UNA SELECCIÓN
  if (userSelections[m.sender]) {
    console.log(`✅ Procesando respuesta de selección: ${input}`);
    
    if (input === '1' || input === 'mp3' || input === 'audio') {
      console.log('🎵 Usuario eligió MP3');
      return await downloadAudio(m, conn, userSelections[m.sender], usedPrefix);
    } else if (input === '2' || input === 'mp4' || input === 'video') {
      console.log('🎬 Usuario eligió MP4');
      return await downloadVideo(m, conn, userSelections[m.sender], usedPrefix);
    } else if (messageText.trim()) {
      return m.reply(
        `❌ *Opción inválida*\n\n` +
        `Por favor responde con:\n` +
        `• *1* o *MP3* o *audio* → para audio\n` +
        `• *2* o *MP4* o *video* → para video\n\n` +
        `_Tienes 2 minutos para responder_`
      );
    }
    return;
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

    // Obtener información adicional
    const videoInfo = await getVideoInfo(video.url);

    // Guardar información del video para la selección del usuario
    userSelections[m.sender] = {
      video: videoInfo || video,
      timestamp: Date.now()
    };
    
    console.log(`💾 Selección guardada para ${m.sender}`);

    // Limpiar selecciones antiguas (más de 2 minutos)
    setTimeout(() => {
      if (userSelections[m.sender]) {
        delete userSelections[m.sender];
        console.log(`⏰ Selección expirada para ${m.sender}`);
      }
    }, 120000);

    // Mostrar resultado y opciones
    const displayInfo = videoInfo || video;
    const message = 
      `╭━━━『 *RESULTADO ENCONTRADO* 』━━━╮\n` +
      `│\n` +
      `│ 🎵 *Título:*\n` +
      `│    ${displayInfo.title}\n` +
      `│\n` +
      `│ 👤 *Canal:* ${displayInfo.author}\n` +
      `│ ⏱️ *Duración:* ${displayInfo.duration}\n` +
      `│ 👁️ *Vistas:* ${formatNumber(displayInfo.views || video.views)}\n` +
      `│ 📅 *Publicado:* ${video.ago || 'Recientemente'}\n` +
      `│\n` +
      `│ 🔗 *URL:* ${displayInfo.url}\n` +
      `│\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
      `┌──────────────────────────\n` +
      `│ *¿CÓMO DESEAS DESCARGARLO?*\n` +
      `│\n` +
      `│ 🎵 Responde *1* o *MP3* para:\n` +
      `│    → Solo audio (320kbps)\n` +
      `│\n` +
      `│ 🎬 Responde *2* o *MP4* para:\n` +
      `│    → Video completo (720p)\n` +
      `│\n` +
      `└──────────────────────────\n\n` +
      `⚠️ *IMPORTANTE: Responde solo con el número 1 o 2*\n` +
      `_⏰ Tienes 2 minutos para responder_`;

    await conn.sendMessage(m.chat, {
      image: { url: displayInfo.thumbnail },
      caption: message,
      contextInfo: {
        externalAdReply: {
          title: displayInfo.title,
          body: `${displayInfo.author} • ${displayInfo.duration}`,
          thumbnailUrl: displayInfo.thumbnail,
          sourceUrl: displayInfo.url,
          mediaType: 1,
          showAdAttribution: false,
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
    await m.reply(
      `⬇️ *Descargando audio MP3...*\n\n` +
      `🎵 ${video.title}\n` +
      `⏱️ Duración: ${video.duration}\n\n` +
      `_Probando con múltiples APIs..._`
    );

    const result = await downloadWithFallback(video.url, AudioAPIs);

    await conn.sendMessage(m.chat, {
      audio: { url: result.url },
      mimetype: 'audio/mpeg',
      fileName: `${sanitizeFilename(result.title || video.title)}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: result.title || video.title,
          body: `${video.author} • ${result.quality || '320kbps'} (${result.source})`,
          thumbnailUrl: result.thumbnail || video.thumbnail,
          sourceUrl: video.url,
          mediaType: 2,
          showAdAttribution: false,
          renderLargerThumbnail: true
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
    await m.reply(
      `⬇️ *Descargando video MP4...*\n\n` +
      `🎬 ${video.title}\n` +
      `⏱️ Duración: ${video.duration}\n\n` +
      `_Esto puede tardar un poco más..._`
    );

    const result = await downloadWithFallback(video.url, VideoAPIs);

    await conn.sendMessage(m.chat, {
      video: { url: result.url },
      mimetype: 'video/mp4',
      fileName: `${sanitizeFilename(result.title || video.title)}.mp4`,
      caption: 
        `╭━━━━━━━━━━━━━━━━━━╮\n` +
        `│ 🎬 *${result.title || video.title}*\n` +
        `│\n` +
        `│ 👤 *Canal:* ${video.author}\n` +
        `│ ⏱️ *Duración:* ${result.duration || video.duration}\n` +
        `│ 📺 *Calidad:* ${result.quality || '720p'}\n` +
        `│ ⚙️ *API:* ${result.source}\n` +
        `│\n` +
        `╰━━━━━━━━━━━━━━━━━━╯`,
      contextInfo: {
        externalAdReply: {
          title: result.title || video.title,
          body: `${video.author} • ${result.quality || '720p'}`,
          thumbnailUrl: result.thumbnail || video.thumbnail,
          sourceUrl: video.url,
          mediaType: 1,
          showAdAttribution: false
        }
      }
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

// Handler de respuestas (BEFORE)
handler.before = async function (m, { conn }) {
  if (!userSelections[m.sender]) return;
  if (m.text?.startsWith('.') || m.text?.startsWith('/') || m.text?.startsWith('!') || m.text?.startsWith('#')) return;const input = (m.text || '').trim().toLowerCase();
  
  if (!input) return;
  
  console.log(`🔔 Respuesta detectada: "${input}" de ${m.sender}`);
  
  if (input === '1' || input === 'mp3' || input === 'audio') {
    console.log('🎵 Procesando descarga de MP3...');
    await downloadAudio(m, conn, userSelections[m.sender], '.');
    return true;
  } else if (input === '2' || input === 'mp4' || input === 'video') {
    console.log('🎬 Procesando descarga de MP4...');
    await downloadVideo(m, conn, userSelections[m.sender], '.');
    return true;
  } else {
    m.reply(
      `❌ *Opción inválida: "${input}"*\n\n` +
      `Por favor responde con:\n` +
      `• *1* o *MP3* para audio\n` +
      `• *2* o *MP4* para video`
    );
    return true;
  }
};

handler.command = ['play', 'musica', 'play3', 'audio'];
handler.help = ['play <canción>'];
handler.tags = ['downloader'];
handler.limit = false;

export default handler;