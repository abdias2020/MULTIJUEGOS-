import axios from 'axios';
import fetch from 'node-fetch';

/* ======================== CONFIGURACIÓN ======================== */
const CONFIG = {
  MEDIAFIRE_API: 'https://api-sky.ultraplus.click/download/mediafire',
  API_KEY: 'sk_5242a5e0-e6b2-41b0-a9f2-7479fc8a60e0',
  MAX_FILE_SIZE: 500, // MB
  TIMEOUT: 30000,
  STICKER_ERROR: 'https://qu.ax/Wdsb.webp'
};

const userCaptions = new Map();
const userRequests = {};

/* ======================== UTILIDADES ======================== */

function isValidMediaFireUrl(url) {
  return /^https?:\/\/(www\.)?mediafire\.com/i.test(url);
}

function formatFileSize(sizeStr) {
  // Si ya viene formateado (ej: "21.63MB"), retornarlo
  if (typeof sizeStr === 'string' && /\d+(\.\d+)?\s*(MB|GB|KB|B)/i.test(sizeStr)) {
    return sizeStr.replace('File ', '').trim();
  }
  
  // Si es un número en bytes
  if (typeof sizeStr === 'number') {
    const mb = sizeStr / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  }
  
  return sizeStr || 'Desconocido';
}

function extractSizeInMB(sizeStr) {
  if (!sizeStr) return 0;
  
  // Extraer números del string
  const match = sizeStr.toString().match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB|B)?/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'MB').toLowerCase();
  
  switch (unit) {
    case 'gb':
      return value * 1024;
    case 'mb':
      return value;
    case 'kb':
      return value / 1024;
    case 'b':
      return value / (1024 * 1024);
    default:
      return value;
  }
}

function cleanFileName(filename) {
  if (!filename) return 'archivo';
  
  // Eliminar duplicaciones en el nombre
  const parts = filename.split(/(?=[A-Z][a-z])|(?<=\.)(?=[^.])/);
  const uniqueParts = [...new Set(parts)];
  let cleaned = uniqueParts.join('');
  
  // Si el nombre está duplicado completamente
  const halfLength = Math.floor(cleaned.length / 2);
  const firstHalf = cleaned.substring(0, halfLength);
  const secondHalf = cleaned.substring(halfLength);
  
  if (firstHalf === secondHalf) {
    cleaned = firstHalf;
  }
  
  return cleaned.trim();
}

async function downloadMediaFireNew(url) {
  try {
    console.log(`🔍 Procesando MediaFire: ${url}`);
    
    const response = await axios.post(
      CONFIG.MEDIAFIRE_API,
      { url: url },
      {
        headers: {
          'apikey': CONFIG.API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.TIMEOUT
      }
    );

    const data = response.data;

    if (!data.status || !data.result || !data.result.files || data.result.files.length === 0) {
      throw new Error('No se encontraron archivos en MediaFire');
    }

    const file = data.result.files[0];

    console.log(`✅ Archivo encontrado: ${file.name}`);

    return {
      filename: cleanFileName(file.name),
      filesize: formatFileSize(file.size),
      download: file.download,
      proxy: file.proxy, // URL proxy alternativa
      total: data.result.total
    };

  } catch (error) {
    console.error('❌ Error en MediaFire API principal:', error.message);
    throw error;
  }
}

// APIs de respaldo
async function downloadMediaFireBackup(url) {
  const backupAPIs = [
    // API 1: Delirius Vercel
    async () => {
      const res = await fetch(`https://delirius-apiofc.vercel.app/download/mediafire?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error(`Error API Delirius: ${res.status}`);
      const json = await res.json();
      const data = json?.data || json?.result || json;
      return { 
        download: data?.url || data?.link || data?.download || data?.dl,
        filename: cleanFileName(data?.title || data?.filename || data?.name),
        filesize: formatFileSize(data?.size || data?.filesize),
        mimetype: data?.mime || data?.mimetype || 'application/octet-stream'
      };
    },
    
    // API 2: Neoxr
    async () => {
      const res = await fetch(`https://api.neoxr.eu/api/mediafire?url=${url}&apikey=russellxz`);
      const data = await res.json();
      if (!data.status || !data.data) throw new Error('Error en Neoxr');
      return { 
        download: data.data.url,
        filename: cleanFileName(data.data.title),
        filesize: formatFileSize(data.data.size),
        mimetype: data.data.mime
      };
    },
    
    // API 3: Agatz
    async () => {
      const res = await fetch(`https://api.agatz.xyz/api/mediafire?url=${url}`);
      const data = await res.json();
      return { 
        download: data.data[0].link,
        filename: cleanFileName(data.data[0].nama),
        filesize: formatFileSize(data.data[0].size),
        mimetype: data.data[0].mime
      };
    },
    
    // API 4: Siputzx
    async () => {
      const res = await fetch(`https://api.siputzx.my.id/api/d/mediafire?url=${url}`);
      const data = await res.json();
      const file = data.data[0];
      return { 
        download: file.link,
        filename: cleanFileName(file.filename),
        filesize: formatFileSize(file.size),
        mimetype: file.mime
      };
    }
  ];

  for (const api of backupAPIs) {
    try {
      const result = await api();
      if (result && result.download) {
        console.log(`✅ Descarga exitosa con API de respaldo`);
        return result;
      }
    } catch (error) {
      console.log(`⚠️ API de respaldo falló: ${error.message}`);
      continue;
    }
  }

  throw new Error('Todas las APIs de respaldo fallaron');
}

function generateCaption(file, version = '1.0') {
  return `╔═══════════════════════╗
║  📁 MEDIAFIRE DOWNLOAD  ║
╚═══════════════════════╝

📌 *Nombre:* ${file.filename}

💾 *Peso:* ${file.filesize}

${file.mimetype ? `📄 *Tipo:* ${file.mimetype}\n` : ''}
┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

> _⏳ Espere un momento, su archivo se está enviando..._`;
}

/* ======================== HANDLER PRINCIPAL ======================== */

const handler = async (m, { conn, args, usedPrefix, command }) => {
  // Validar que se proporcionó una URL
  if (!args[0]) {
    return m.reply(
      `╔═══════════════════════╗\n` +
      `║  ⚠️ FALTA LA URL  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `📝 *Uso correcto:*\n` +
      `${usedPrefix + command} <url de MediaFire>\n\n` +
      `💡 *Ejemplo:*\n` +
      `${usedPrefix + command} https://www.mediafire.com/file/ejemplo/file.zip`
    );
  }

  // Validar URL de MediaFire
  if (!isValidMediaFireUrl(args[0])) {
    return m.reply(
      `╔═══════════════════════╗\n` +
      `║  ⚠️ URL INVÁLIDA  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `❌ *Enlace no válido.*\n\n` +
      `📌 Asegúrate de ingresar una URL de MediaFire válida.\n\n` +
      `✅ *Ejemplo válido:*\n` +
      `\`${usedPrefix + command} https://www.mediafire.com/file/ejemplo/archivo.zip\``
    );
  }

  // Verificar si el usuario ya tiene una descarga en proceso
  if (userRequests[m.sender]) {
    return await conn.reply(
      m.chat,
      `⚠️ Hey @${m.sender.split('@')[0]}, ya estás descargando algo 🙄\n\n` +
      `Espera a que termine tu solicitud actual antes de hacer otra...`,
      userCaptions.get(m.sender) || m,
      { mentions: [m.sender] }
    );
  }

  userRequests[m.sender] = true;
  await m.react("🔍");

  try {
    let fileData = null;

    // Intentar con la API principal (Nueva API)
    try {
      console.log('🚀 Intentando con API principal...');
      fileData = await downloadMediaFireNew(args[0]);
    } catch (error) {
      console.log(`⚠️ API principal falló: ${error.message}`);
      console.log('🔄 Intentando con APIs de respaldo...');
      
      // Si falla, intentar con APIs de respaldo
      try {
        fileData = await downloadMediaFireBackup(args[0]);
      } catch (backupError) {
        throw new Error(
          `No se pudo descargar el archivo.\n\n` +
          `Posibles causas:\n` +
          `• El enlace ha expirado\n` +
          `• El archivo fue eliminado\n` +
          `• MediaFire está bloqueando el acceso\n\n` +
          `*Error:* ${backupError.message}`
        );
      }
    }

    if (!fileData || !fileData.download) {
      throw new Error('No se pudo obtener el enlace de descarga');
    }

    await m.react("⏳");

    // Verificar tamaño del archivo
    const sizeInMB = extractSizeInMB(fileData.filesize);
    
    if (sizeInMB > CONFIG.MAX_FILE_SIZE) {
      await m.reply(
        `╔═══════════════════════╗\n` +
        `║  ⚠️ ARCHIVO MUY GRANDE  ║\n` +
        `╚═══════════════════════╝\n\n` +
        `📁 *Archivo:* ${fileData.filename}\n` +
        `💾 *Tamaño:* ${fileData.filesize}\n` +
        `🚫 *Límite:* ${CONFIG.MAX_FILE_SIZE} MB\n\n` +
        `_No se puede enviar por WhatsApp debido a su tamaño._\n\n` +
        `🔗 *Descarga directa:*\n${fileData.download}`
      );
      
      await m.react("⚠️");
      return;
    }

    // Enviar información del archivo
    const caption = generateCaption(fileData);
    const captionMessage = await conn.reply(m.chat, caption, m);
    userCaptions.set(m.sender, captionMessage);

    await m.react("⬇️");

    // Enviar archivo
    try {
      await conn.sendMessage(
        m.chat,
        {
          document: { url: fileData.download },
          mimetype: fileData.mimetype || 'application/octet-stream',
          fileName: fileData.filename
        },
        { quoted: m }
      );

      console.log(`✅ Archivo enviado: ${fileData.filename}`);
      await m.react('✅');

    } catch (sendError) {
      console.error('Error enviando archivo:', sendError);
      
      // Si falla el envío, intentar con la URL proxy si está disponible
      if (fileData.proxy) {
        console.log('🔄 Intentando con URL proxy...');
        await conn.sendMessage(
          m.chat,
          {
            document: { url: fileData.proxy },
            mimetype: fileData.mimetype || 'application/octet-stream',
            fileName: fileData.filename
          },
          { quoted: m }
        );
        
        await m.react('✅');
      } else {
        throw new Error(`Error al enviar el archivo: ${sendError.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error en handler:', error);
    
    await m.react('❌');
    
    try {
      await conn.sendFile(m.chat, CONFIG.STICKER_ERROR, 'error.webp', '', m);
    } catch (e) {
      // Ignorar error del sticker
    }
    
    await conn.reply(
      m.chat,
      `╔═══════════════════════╗\n` +
      `║  ❌ OCURRIÓ UN ERROR  ║\n` +
      `╚═══════════════════════╝\n\n` +
      `${error.message}\n\n` +
      `💡 *Sugerencias:*\n` +
      `• Verifica que el enlace sea correcto\n` +
      `• Asegúrate de que el archivo aún existe\n` +
      `• Intenta con otro archivo\n` +
      `• Espera unos minutos e intenta nuevamente`,
      m
    );
    
    handler.limit = false;
    
  } finally {
    delete userRequests[m.sender];
  }
};

/* ======================== METADATA ======================== */

handler.help = ['mediafire', 'mediafiredl'];
handler.tags = ['downloader'];
handler.command = /^(mediafire|mediafiredl|dlmediafire)$/i;
handler.register = true;
handler.limit = 3;

export default handler;