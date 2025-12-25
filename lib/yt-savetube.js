import axios from 'axios';
import crypto from 'crypto';
import * as cheerio from 'cheerio';

const savetube = {
  api: {
    base: "https://media.savetube.me/api",
    cdn: "/random-cdn",
    info: "/v2/info", 
    download: "/download",
    ytInfo: "https://www.youtube.com/oembed"
  },
  
  headers: {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://yt.savetube.me',
    'referer': 'https://yt.savetube.me/',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  },
  
  formats: {
    video: ['144', '240', '360', '480', '720', '1080', '1440', '2160'],
    audio: ['mp3', 'm4a', 'opus']
  },

  crypto: {
    hexToBuffer: (hexString) => {
      if (!hexString) throw new Error('hexString is required');
      const matches = hexString.match(/.{1,2}/g);
      if (!matches) throw new Error('Invalid hex string');
      return Buffer.from(matches.join(''), 'hex');
    },

    decrypt: async (enc, secretKey = 'C5D58EF67A7584E4A29F6C35BBC4EB12') => {
      try {
        if (!enc) throw new Error('Encrypted data is required');
        
        const data = Buffer.from(enc, 'base64');
        if (data.length < 16) throw new Error('Invalid encrypted data length');
        
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = savetube.crypto.hexToBuffer(secretKey);
        
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(content);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const result = JSON.parse(decrypted.toString('utf8'));
        return result;
      } catch (error) {
        throw new Error(`Decryption failed: ${error.message}`);
      }
    }
  },

  utils: {
    isUrl: (str) => { 
      if (!str || typeof str !== 'string') return false;
      try { 
        new URL(str); 
        return true; 
      } catch (_) { 
        return false; 
      } 
    },

    extractYoutubeId: (url) => {
      if (!url) return null;
      
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^[a-zA-Z0-9_-]{11}$/
      ];
      
      for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1] || match[0];
      }
      
      return null;
    },

    formatBytes: (bytes, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    formatDuration: (seconds) => {
      if (!seconds || isNaN(seconds)) return '0:00';
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    validateFormat: (format) => {
      if (!format) return { valid: false, type: null };
      
      const fmt = format.toString().toLowerCase();
      
      if (savetube.formats.video.includes(fmt)) {
        return { valid: true, type: 'video', format: fmt };
      }
      
      if (savetube.formats.audio.includes(fmt)) {
        return { valid: true, type: 'audio', format: fmt };
      }
      
      return { valid: false, type: null };
    }
  },

  request: async (endpoint, data = {}, method = 'post', customHeaders = {}) => {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config = {
          method,
          url: endpoint.startsWith('http') ? endpoint : `${savetube.api.base}${endpoint}`,
          headers: { ...savetube.headers, ...customHeaders },
          timeout: 30000,
          validateStatus: (status) => status < 500
        };

        if (method === 'post') {
          config.data = data;
        } else {
          config.params = data;
        }

        const response = await axios(config);

        if (response.status === 200 || response.status === 201) {
          return {
            status: true,
            code: response.status,
            data: response.data
          };
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
    }

    return {
      status: false,
      code: lastError.response?.status || 500,
      error: lastError.message || 'Request failed after retries'
    };
  },

  getCDN: async () => {
    try {
      const response = await savetube.request(savetube.api.cdn, {}, 'get');
      
      if (!response.status) {
        throw new Error(response.error || 'Failed to get CDN');
      }

      if (!response.data?.cdn) {
        throw new Error('CDN not found in response');
      }

      return {
        status: true,
        code: 200,
        data: response.data.cdn
      };
    } catch (error) {
      return {
        status: false,
        code: 500,
        error: `CDN Error: ${error.message}`
      };
    }
  },

  getVideoInfo: async (videoId) => {
    try {
      const response = await axios.get(`${savetube.api.ytInfo}?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
        headers: {
          'user-agent': savetube.headers['user-agent']
        },
        timeout: 10000
      });

      return {
        title: response.data.title || 'Unknown',
        author: response.data.author_name || 'Unknown',
        thumbnail: response.data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
      };
    } catch (error) {
      return {
        title: 'Unknown',
        author: 'Unknown',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
      };
    }
  },

  download: async (link, format = '360') => {
    // Validación del link
    if (!link) {
      return {
        status: false,
        code: 400,
        error: "❌ Link requerido. Proporciona un enlace de YouTube válido."
      };
    }

    if (!savetube.utils.isUrl(link) && !savetube.utils.extractYoutubeId(link)) {
      return {
        status: false,
        code: 400,
        error: "❌ URL inválida. Asegúrate de proporcionar un enlace válido de YouTube."
      };
    }

    // Validación del formato
    const formatValidation = savetube.utils.validateFormat(format);
    if (!formatValidation.valid) {
      return {
        status: false,
        code: 400,
        error: "❌ Formato no válido.",
        available_formats: {
          video: savetube.formats.video,
          audio: savetube.formats.audio
        }
      };
    }

    // Extraer ID del video
    const videoId = savetube.utils.extractYoutubeId(link);
    if (!videoId) {
      return {
        status: false,
        code: 400,
        error: "❌ No se pudo extraer el ID del video de YouTube."
      };
    }

    try {
      // Obtener CDN
      const cdnResponse = await savetube.getCDN();
      if (!cdnResponse.status) {
        throw new Error(cdnResponse.error || 'Failed to get CDN');
      }
      const cdn = cdnResponse.data;

      // Obtener información del video
      const videoInfo = await savetube.getVideoInfo(videoId);

      // Obtener información encriptada
      const infoResponse = await savetube.request(
        `https://${cdn}${savetube.api.info}`,
        { url: `https://www.youtube.com/watch?v=${videoId}` }
      );

      if (!infoResponse.status) {
        throw new Error(infoResponse.error || 'Failed to get video info');
      }

      if (!infoResponse.data?.data) {
        throw new Error('No encrypted data received');
      }

      // Desencriptar datos
      const decrypted = await savetube.crypto.decrypt(infoResponse.data.data);

      if (!decrypted?.key) {
        throw new Error('Invalid decrypted data: missing key');
      }

      // Preparar parámetros de descarga
      const downloadType = formatValidation.type;
      const quality = downloadType === 'audio' ? '128' : formatValidation.format;

      // Solicitar descarga
      const downloadResponse = await savetube.request(
        `https://${cdn}${savetube.api.download}`,
        {
          id: videoId,
          downloadType: downloadType,
          quality: quality,
          key: decrypted.key
        }
      );

      if (!downloadResponse.status) {
        throw new Error(downloadResponse.error || 'Download request failed');
      }

      if (!downloadResponse.data?.data?.downloadUrl) {
        throw new Error('No download URL received');
      }

      // Construir resultado
      return {
        status: true,
        code: 200,
        result: {
          title: decrypted.title || videoInfo.title,
          author: videoInfo.author,
          type: downloadType,
          format: formatValidation.format,
          quality: quality,
          thumbnail: decrypted.thumbnail || videoInfo.thumbnail,
          duration: decrypted.duration ? savetube.utils.formatDuration(decrypted.duration) : 'Unknown',
          durationSeconds: decrypted.duration || 0,
          download: downloadResponse.data.data.downloadUrl,
          videoId: videoId,
          key: decrypted.key,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          cdn: cdn,
          downloaded: downloadResponse.data.data.downloaded || false,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      return {
        status: false,
        code: 500,
        error: `❌ Error: ${error.message}`,
        details: error.stack
      };
    }
  },

  // Método adicional para obtener múltiples formatos
  getAllFormats: async (link) => {
    const videoId = savetube.utils.extractYoutubeId(link);
    if (!videoId) {
      return {
        status: false,
        code: 400,
        error: "❌ URL de YouTube inválida"
      };
    }

    try {
      const cdnResponse = await savetube.getCDN();
      if (!cdnResponse.status) throw new Error(cdnResponse.error);
      
      const cdn = cdnResponse.data;
      const videoInfo = await savetube.getVideoInfo(videoId);

      const infoResponse = await savetube.request(
        `https://${cdn}${savetube.api.info}`,
        { url: `https://www.youtube.com/watch?v=${videoId}` }
      );

      if (!infoResponse.status) throw new Error(infoResponse.error);
      const decrypted = await savetube.crypto.decrypt(infoResponse.data.data);

      return {
        status: true,
        code: 200,
        result: {
          videoId: videoId,
          title: decrypted.title || videoInfo.title,
          author: videoInfo.author,
          thumbnail: decrypted.thumbnail || videoInfo.thumbnail,
          duration: savetube.utils.formatDuration(decrypted.duration),
          durationSeconds: decrypted.duration,
          availableFormats: {
            video: savetube.formats.video,
            audio: savetube.formats.audio
          },
          key: decrypted.key,
          cdn: cdn
        }
      };
    } catch (error) {
      return {
        status: false,
        code: 500,
        error: `❌ Error: ${error.message}`
      };
    }
  }
};

export { savetube };