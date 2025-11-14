import fetch from 'node-fetch';
const userCaptions = new Map();
const userRequests = {};

let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!args[0]) {
    return m.reply(`⚠️ Ingrese una Url de Drive\n• Ejemplo: ${usedPrefix + command} https://drive.google.com/file/d/1-8BSwPSAycKYMqveGm_JTu2c_wIDkJIt/view?usp=drivesdk`);
  }

  if (userRequests[m.sender]) {
    conn.reply(m.chat, `⏳ *Hey @${m.sender.split('@')[0]} Espera...* Ya hay una solicitud en proceso. Por favor, espera a que termine antes de hacer otra...`, userCaptions.get(m.sender) || m);
    return;
  }
  
  userRequests[m.sender] = true;
  m.react("📥");
  
  try {
    const waitMessageSent = await conn.reply(m.chat, `*⌛ 𝐂𝐚𝐥𝐦𝐚 ✋ 𝐂𝐥𝐚𝐜𝐤, 𝐘𝐚 𝐞𝐬𝐭𝐨𝐲 𝐄𝐧𝐯𝐢𝐚𝐝𝐨 𝐞𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 🚀*\n*𝐒𝐢 𝐧𝐨 𝐥𝐞 𝐥𝐥𝐞𝐠𝐚 𝐞𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐞𝐬 𝐝𝐞𝐛𝐢𝐝𝐨 𝐚 𝐪𝐮𝐞 𝐞𝐬 𝐦𝐮𝐲 𝐩𝐞𝐬𝐚𝐝𝐨*`, m);
    userCaptions.set(m.sender, waitMessageSent);
    
    const downloadAttempts = [
      // API 1
      async () => {
        const api = await fetch(`https://api.siputzx.my.id/api/d/gdrive?url=${encodeURIComponent(args[0])}`);
        if (!api.ok) throw new Error(`Estado ${api.status}`);
        const data = await api.json();
        
        if (!data?.data?.download || !data?.data?.name) {
          throw new Error('Estructura de datos inválida');
        }
        
        return {
          url: data.data.download,
          filename: data.data.name,
        };
      },
      // API 2
      async () => {
        const api = await fetch(`https://apis.davidcyriltech.my.id/gdrive?url=${encodeURIComponent(args[0])}`);
        if (!api.ok) throw new Error(`Estado ${api.status}`);
        const data = await api.json();
        
        if (!data?.download_link || !data?.name) {
          throw new Error('Estructura de datos inválida');
        }
        
        return {
          url: data.download_link,
          filename: data.name,
        };
      },
      // API 3
      async () => {
        const api = await fetch(`https://api.agatz.xyz/api/gdrive?url=${encodeURIComponent(args[0])}`);
        if (!api.ok) throw new Error(`Estado ${api.status}`);
        const data = await api.json();
        
        if (!data?.data?.download || !data?.data?.fileName) {
          throw new Error('Estructura de datos inválida');
        }
        
        return {
          url: data.data.download,
          filename: data.data.fileName,
        };
      },
      // API 4
      async () => {
        const api = await fetch(`https://api.betabotz.eu.org/api/download/gdrive?url=${encodeURIComponent(args[0])}&apikey=bot`);
        if (!api.ok) throw new Error(`Estado ${api.status}`);
        const data = await api.json();
        
        if (!data?.result?.download || !data?.result?.fileName) {
          throw new Error('Estructura de datos inválida');
        }
        
        return {
          url: data.result.download,
          filename: data.result.fileName,
        };
      },
      // API 5
      async () => {
        const api = await fetch(`https://api.telegram.org/bot6936929018:AAEmURJYjNGNMhqKupJOg5HKqG7nRRfKPAE/sendDocument?chat_id=5000630589&document=${encodeURIComponent(args[0])}`);
        if (!api.ok) throw new Error(`Estado ${api.status}`);
        const data = await api.json();
        
        if (!data?.result?.document?.file_id) {
          throw new Error('Estructura de datos inválida');
        }
        
        // Obtener info del archivo
        const fileInfo = await fetch(`https://api.telegram.org/bot6936929018:AAEmURJYjNGNMhqKupJOg5HKqG7nRRfKPAE/getFile?file_id=${data.result.document.file_id}`);
        const fileData = await fileInfo.json();
        
        return {
          url: `https://api.telegram.org/file/bot6936929018:AAEmURJYjNGNMhqKupJOg5HKqG7nRRfKPAE/${fileData.result.file_path}`,
          filename: data.result.document.file_name,
        };
      },
      // API 6 - Método directo de Google Drive
      async () => {
        const fileId = extractGDriveFileId(args[0]);
        if (!fileId) throw new Error('No se pudo extraer el ID del archivo');
        
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        const response = await fetch(directUrl, { method: 'HEAD' });
        
        if (!response.ok) throw new Error(`Estado ${response.status}`);
        
        // Intentar obtener el nombre del archivo de los headers
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'archivo_drive';
        
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match && match[1]) {
            filename = match[1].replace(/['"]/g, '');
          }
        }
        
        // Si no hay extensión, intentar adivinar por content-type
        if (!filename.includes('.')) {
          const contentType = response.headers.get('content-type');
          const ext = getExtensionFromMimetype(contentType);
          filename += ext;
        }
        
        return {
          url: directUrl,
          filename: filename,
        };
      },
    ];

    let fileData = null;
    const errors = [];

    for (let i = 0; i < downloadAttempts.length; i++) {
      try {
        console.log(`Intentando con API ${i + 1}...`);
        fileData = await downloadAttempts[i]();
        
        if (fileData?.url && fileData?.filename) {
          console.log(`✅ Éxito con API ${i + 1}`);
          console.log(`Archivo: ${fileData.filename}`);
          console.log(`URL: ${fileData.url}`);
          break;
        }
      } catch (err) {
        errors.push(`API ${i + 1}: ${err.message}`);
        console.error(`❌ Error en API ${i + 1}: ${err.message}`);
        continue;
      }
    }

    if (!fileData || !fileData.url || !fileData.filename) {
      throw new Error(`No se pudo descargar el archivo desde ninguna API.\n\nErrores:\n${errors.join('\n')}\n\nAsegúrate de que:\n- El enlace sea público\n- El archivo no esté eliminado\n- Tengas permisos de visualización`);
    }

    const { url, filename } = fileData;
    const mimetype = getMimetype(filename);
    
    await conn.sendMessage(m.chat, { 
      document: { url: url }, 
      mimetype: mimetype, 
      fileName: filename, 
      caption: `📄 *${filename}*\n\n_Descargado exitosamente desde Google Drive_ ✅` 
    }, { quoted: m });
    
    await m.react("✅");
  } catch (e) {
    await m.react(`❌`);
    m.reply(`\`\`\`⚠️ OCURRIO UN ERROR ⚠️\`\`\`\n\n> *Reporta el siguiente error a mi creador con el comando:* #report\n\n>>> ${e.message || e} <<<<`);
    console.error('Error completo:', e);
  } finally {
    delete userRequests[m.sender];
  }
};

handler.help = ['drive'].map(v => v + ' <url>');
handler.tags = ['downloader'];
handler.command = /^(drive|drivedl|dldrive|gdrive)$/i;
handler.register = true;
handler.limit = 3;

export default handler;

// Función para extraer el ID del archivo de Google Drive
const extractGDriveFileId = (url) => {
  const patterns = [
    /\/file\/d\/([^\/]+)/,
    /id=([^&]+)/,
    /\/d\/([^\/]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// Función para obtener extensión desde mimetype
const getExtensionFromMimetype = (mimetype) => {
  const mimetypeMap = {
    'application/pdf': '.pdf',
    'video/mp4': '.mp4',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/zip': '.zip',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt',
    'audio/mpeg': '.mp3',
  };
  return mimetypeMap[mimetype] || '';
};

const getMimetype = (fileName) => {
  if (!fileName || typeof fileName !== 'string') {
    console.error('getMimetype: fileName inválido:', fileName);
    return 'application/octet-stream';
  }
  
  const extension = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'mp4': 'video/mp4',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'zip': 'application/zip',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'mp3': 'audio/mpeg',
    'apk': 'application/vnd.android.package-archive',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
  };
  return mimeTypes[extension] || 'application/octet-stream';
};