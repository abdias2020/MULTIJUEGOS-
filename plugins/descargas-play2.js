import fetch from 'node-fetch';
import yts from 'yt-search';
import ytdl from 'ytdl-core';
import axios from 'axios';
import { savetube } from '../lib/yt-savetube.js';
import { ogmp3 } from '../lib/youtubedl.js';
import { amdl, ytdown } from '../lib/scraper.js';

const userRequests = {};
const TIMEOUT = 15000; // 15 segundos por API

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  console.log('🎵 Comando ejecutado:', command);
  console.log('📝 Args:', args);
  console.log('👤 Usuario:', m.sender);

  // Validación de entrada
  if (!args[0]) {
    return m.reply(
      `*🤔 ¿Qué estás buscando?*\n\n` +
      `Ejemplos de uso:\n` +
      `• ${usedPrefix + command} https://youtu.be/ejemplo\n` +
      `• ${usedPrefix + command} Nombre de la canción\n` +
      `• ${usedPrefix + command} 1 (si buscaste antes)\n\n` +
      `_Ingresa el enlace de YouTube o el nombre de la canción_`
    );
  }

  // Control de solicitudes simultáneas
  if (userRequests[m.sender]) {
    return m.reply(
      `⏳ *Espera...* Ya hay una descarga en proceso.\n\n` +
      `Por favor, espera a que termine antes de hacer otra solicitud.`
    );
  }

  userRequests[m.sender] = true;

  try {
    const sendType = command.includes('doc') ? 'document' : 
                     command.includes('mp3') ? 'audio' : 'video';
    
    const isAudio = ['ytmp3', 'fgmp3', 'ytmp3doc'].includes(command);
    const isVideo = ['ytmp4', 'fgmp4', 'ytmp4doc'].includes(command);

    // Obtener URL de YouTube
    let youtubeLink = await getYouTubeLink(args, m);
    if (!youtubeLink) {
      return m.reply('❌ No se pudo obtener el enlace de YouTube. Verifica tu búsqueda.');
    }

    console.log('🔗 URL obtenida:', youtubeLink);

    // Buscar información del video
    const yt_play = await search(youtubeLink);
    const videoInfo = yt_play[0];

    if (!videoInfo) {
      return m.reply('❌ No se encontró información del video. Intenta con otro enlace.');
    }

    console.log('📺 Video encontrado:', videoInfo.title);

    // Mensajes de proceso
    if (isAudio) {
      await m.reply(
        `🎵 *Descargando Audio*\n\n` +
        `📌 *Título:* ${videoInfo.title}\n` +
        `👤 *Canal:* ${videoInfo.author.name}\n` +
        `⏱️ *Duración:* ${videoInfo.timestamp}\n\n` +
        `⏳ _Procesando audio, espera un momento..._`
      );
    } else if (isVideo) {
      await m.reply(
        `🎬 *Descargando Video*\n\n` +
        `📌 *Título:* ${videoInfo.title}\n` +
        `👤 *Canal:* ${videoInfo.author.name}\n` +
        `⏱️ *Duración:* ${videoInfo.timestamp}\n\n` +
        `⏳ _Procesando video, espera un momento..._`
      );
    }

    // Descargar contenido
    if (isAudio) {
      await downloadAudio(conn, m, youtubeLink, videoInfo, sendType);
    } else if (isVideo) {
      await downloadVideo(conn, m, youtubeLink, videoInfo, sendType, args);
    }

  } catch (error) {
    console.error('❌ Error general:', error);
    await m.reply(
      `🚫 *Ocurrió un error al procesar tu solicitud*\n\n` +
      `*Error:* ${error.message}\n\n` +
      `_Intenta con otro enlace o nombre de canción_`
    );
    m.react('❌');
  } finally {
    delete userRequests[m.sender];
    console.log('🧹 Solicitud limpiada para:', m.sender);
  }
};

// ===============================
// FUNCIONES AUXILIARES
// ===============================

/**
 * Obtiene el enlace de YouTube desde args
 */
async function getYouTubeLink(args, m) {
  try {
    // Si es un enlace directo
    if (args[0].includes('you')) {
      return args[0];
    }

    // Si es un número de índice
    const index = parseInt(args[0]) - 1;
    if (!isNaN(index) && index >= 0) {
      if (Array.isArray(global.videoList) && global.videoList.length > 0) {
        const matchingItem = global.videoList.find(item => item.from === m.sender);
        if (matchingItem && matchingItem.urls[index]) {
          return matchingItem.urls[index];
        }
      }
      throw new Error('No se encontró un enlace para ese número');
    }

    // Si es una búsqueda por nombre
    const searchQuery = args.join(' ');
    const results = await search(searchQuery);
    if (results && results[0]) {
      return results[0].url;
    }

    return null;
  } catch (error) {
    console.error('Error en getYouTubeLink:', error);
    return null;
  }
}

/**
 * Descarga audio desde múltiples APIs
 */
async function downloadAudio(conn, m, url, videoInfo, sendType) {
  const apis = [
    {
      name: 'SaveTube',
      fn: async () => {
        const result = await savetube.download(url, 'mp3');
        return result?.result?.download;
      }
    },
    {
      name: 'AMDL',
      fn: async () => {
        const response = await amdl.download(url, '720p');
        return response?.result?.type === 'audio' ? response.result.download : null;
      }
    },
    {
      name: 'YTDown',
      fn: async () => {
        const response = await ytdown.download(url, 'mp3');
        return response?.type === 'audio' ? response.download : null;
      }
    },
    {
      name: 'Siputzx',
      fn: async () => {
        const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        return json?.data?.dl;
      }
    },
    {
      name: 'Agatz',
      fn: async () => {
        const res = await fetch(`https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        return json?.data?.downloadUrl;
      }
    },
    {
      name: 'Zenkey',
      fn: async () => {
        const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp3?apikey=zenkey&url=${encodeURIComponent(url)}`);
        const json = await res.json();
        return json?.result?.download?.url;
      }
    },
    {
      name: 'YTDL-Core',
      fn: async () => {
        const searchResults = await yts(url);
        const video = searchResults.videos[0];
        if (!video) return null;
        
        const info = await ytdl.getInfo('https://youtu.be/' + video.videoId);
        const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
        return format?.url;
      }
    }
  ];

  let downloadUrl = null;

  // Intentar con cada API
  for (const api of apis) {
    try {
      console.log(`🔄 Intentando ${api.name}...`);
      
      const result = await Promise.race([
        api.fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
        )
      ]);

      if (result && await isValidUrl(result)) {
        downloadUrl = result;
        console.log(`✅ ${api.name} exitoso`);
        break;
      } else {
        console.log(`⚠️ ${api.name}: URL no válida`);
      }
    } catch (error) {
      console.log(`❌ ${api.name} falló:`, error.message);
      continue;
    }
  }

  if (!downloadUrl) {
    throw new Error('No se pudo descargar el audio desde ninguna API');
  }

  // Enviar audio
  console.log('📤 Enviando audio...');
  
  await conn.sendMessage(
    m.chat,
    {
      [sendType]: { url: downloadUrl },
      mimetype: 'audio/mpeg',
      fileName: `${videoInfo.title}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: videoInfo.title,
          body: videoInfo.author.name,
          thumbnailUrl: videoInfo.thumbnail,
          sourceUrl: url,
          mediaType: 1,
          showAdAttribution: false,
          renderLargerThumbnail: true
        }
      }
    },
    { quoted: m }
  );

  m.react('✅');
  console.log('✅ Audio enviado correctamente');
}

/**
 * Descarga video desde múltiples APIs
 */
async function downloadVideo(conn, m, url, videoInfo, sendType, args) {
  const quality = args[1] || '720';
  
  const apis = [
    {
      name: 'SaveTube',
      fn: async () => {
        const result = await savetube.download(url, '720');
        return result?.result?.download;
      }
    },
    {
      name: 'OgMp3',
      fn: async () => {
        const res = await ogmp3.download(url, quality, 'video');
        return res?.result?.download;
      }
    },
    {
      name: 'AMDL',
      fn: async () => {
        const response = await amdl.download(url, `${quality}p`);
        return response?.result?.type === 'video' ? response.result.download : null;
      }
    },
    {
      name: 'YTDown',
      fn: async () => {
        const response = await ytdown.download(url, 'mp4');
        return response?.type === 'video' ? response.download : null;
      }
    },
    {
      name: 'Siputzx',
      fn: async () => {
        const res = await fetch(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        return json?.data?.dl;
      }
    },
    {
      name: 'Agatz',
      fn: async () => {
        const res = await fetch(`https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        return json?.data?.downloadUrl;
      }
    },
    {
      name: 'Zenkey',
      fn: async () => {
        const res = await fetch(`https://api.zenkey.my.id/api/download/ytmp4?apikey=zenkey&url=${encodeURIComponent(url)}`);
        const json = await res.json();
        return json?.result?.download?.url;
      }
    },
    {
      name: 'Axeel',
      fn: async () => {
        const res = await fetch(`https://axeel.my.id/api/download/video?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        return json?.downloads?.url;
      }
    },
    {
      name: 'YTDL Custom',
      fn: async () => {
        return await ytMp4(url);
      }
    }
  ];

  let downloadUrl = null;

  // Intentar con cada API
  for (const api of apis) {
    try {
      console.log(`🔄 Intentando ${api.name}...`);
      
      const result = await Promise.race([
        api.fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
        )
      ]);

      const videoUrl = typeof result === 'string' ? result : result?.result;
      
      if (videoUrl && await isValidUrl(videoUrl)) {
        downloadUrl = videoUrl;
        console.log(`✅ ${api.name} exitoso`);
        break;
      } else {
        console.log(`⚠️ ${api.name}: URL no válida`);
      }
    } catch (error) {
      console.log(`❌ ${api.name} falló:`, error.message);
      continue;
    }
  }

  if (!downloadUrl) {
    throw new Error('No se pudo descargar el video desde ninguna API');
  }

  // Enviar video
  console.log('📤 Enviando video...');
  
  await conn.sendMessage(
    m.chat,
    {
      [sendType]: { url: downloadUrl },
      mimetype: 'video/mp4',
      fileName: `${videoInfo.title}.mp4`,
      caption: `🎬 *${videoInfo.title}*\n👤 ${videoInfo.author.name}\n📺 Calidad: ${quality}p`,
      contextInfo: {
        externalAdReply: {
          title: videoInfo.title,
          body: videoInfo.author.name,
          thumbnailUrl: videoInfo.thumbnail,
          sourceUrl: url,
          mediaType: 2
        }
      }
    },
    { quoted: m }
  );

  m.react('✅');
  console.log('✅ Video enviado correctamente');
}

/**
 * Valida si una URL es reproducible
 */
async function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';
    const isValid = res.ok && (
      contentType.includes('audio') ||
      contentType.includes('video') ||
      contentType.includes('octet-stream')
    );

    console.log(`🔍 Validación - Status: ${res.status}, Type: ${contentType}, Valid: ${isValid}`);
    return isValid;
  } catch (error) {
    console.log('⚠️ Error validando URL:', error.message);
    return false;
  }
}

/**
 * Busca videos en YouTube
 */
async function search(query, options = {}) {
  try {
    const search = await yts.search({ query, hl: 'es', gl: 'ES', ...options });
    return search.videos;
  } catch (error) {
    console.error('Error en búsqueda:', error);
    return [];
  }
}

/**
 * Convierte bytes a tamaño legible
 */
function bytesToSize(bytes) {
  return new Promise((resolve) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return resolve('n/a');
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
    if (i === 0) resolve(`${bytes} ${sizes[i]}`);
    resolve(`${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`);
  });
}

/**
 * Descarga MP3 usando ytdl-core
 */
async function ytMp3(url) {
  return new Promise((resolve, reject) => {
    ytdl.getInfo(url)
      .then(async (getUrl) => {
        let result = [];
        for (let i = 0; i < getUrl.formats.length; i++) {
          let item = getUrl.formats[i];
          if (item.mimeType == 'audio/webm; codecs="opus"') {
            let { contentLength } = item;
            let bytes = await bytesToSize(contentLength);
            result[i] = { audio: item.url, size: bytes };
          }
        }
        let resultFix = result.filter(x => x.audio && x.size);
        let tiny = await axios.get(`https://tinyurl.com/api-create.php?url=${resultFix[0].audio}`);
        let tinyUrl = tiny.data;
        let title = getUrl.videoDetails.title;
        let thumb = getUrl.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url;
        resolve({ title, result: tinyUrl, result2: resultFix, thumb });
      })
      .catch(reject);
  });
}

/**
 * Descarga MP4 usando ytdl-core
 */
async function ytMp4(url) {
  return new Promise(async (resolve, reject) => {
    ytdl.getInfo(url)
      .then(async (getUrl) => {
        let result = [];
        for (let i = 0; i < getUrl.formats.length; i++) {
          let item = getUrl.formats[i];
          if (item.container == 'mp4' && item.hasVideo && item.hasAudio) {
            let { qualityLabel, contentLength } = item;
            let bytes = await bytesToSize(contentLength);
            result[i] = { video: item.url, quality: qualityLabel, size: bytes };
          }
        }
        let resultFix = result.filter(x => x.video && x.size && x.quality);
        let tiny = await axios.get(`https://tinyurl.com/api-create.php?url=${resultFix[0].video}`);
        let tinyUrl = tiny.data;
        let title = getUrl.videoDetails.title;
        let thumb = getUrl.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url;
        resolve({ title, result: tinyUrl, result2: resultFix[0].video, thumb });
      })
      .catch(reject);
  });
}

/**
 * Reproduce audio desde búsqueda
 */
async function ytPlay(query) {
  return new Promise((resolve, reject) => {
    yts(query)
      .then(async (getData) => {
        let result = getData.videos.slice(0, 5);
        let url = result.map(v => v.url);
        let random = url[0];
        let getAudio = await ytMp3(random);
        resolve(getAudio);
      })
      .catch(reject);
  });
}

/**
 * Reproduce video desde búsqueda
 */
async function ytPlayVid(query) {
  return new Promise((resolve, reject) => {
    yts(query)
      .then(async (getData) => {
        let result = getData.videos.slice(0, 5);
        let url = result.map(v => v.url);
        let random = url[0];
        let getVideo = await ytMp4(random);
        resolve(getVideo);
      })
      .catch(reject);
  });
}

// Configuración del handler
handler.help = ['ytmp3', 'ytmp4', 'fgmp3', 'fgmp4'];
handler.tags = ['downloader'];
handler.command = /^(ytmp3|ytmp4|fgmp4|fgmp3|dlmp3|ytmp4doc|ytmp3doc)$/i;

export default handler;