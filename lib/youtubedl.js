import axios from 'axios';
import crypto from 'crypto';

const ogmp3 = {
  api: {
    base: "https://api3.apiapi.lat",
    endpoints: {
      primary: "https://api5.apiapi.lat",
      secondary: "https://api.apiapi.lat",
      tertiary: "https://api3.apiapi.lat",
      backup: "https://api2.apiapi.lat"
    }
  },

  headers: {
    'authority': 'api.apiapi.lat',
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://ogmp3.lat',
    'referer': 'https://ogmp3.lat/',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  },
 
  formats: {
    video: ['144', '240', '360', '480', '720', '1080', '1440', '2160'], // Agregado 1440p y 4K
    audio: ['64', '96', '128', '192', '256', '320', '480'] // Agregado 480kbps
  },

  default_fmt: {
    video: '720',
    audio: '320'
  },

  // Zonas horarias restringidas (GMT offsets en minutos)
  restrictedTimezones: new Set(["-330", "-420", "-480", "-540"]),

  // Configuración de timeouts y reintentos
  config: {
    requestTimeout: 30000, // 30 segundos
    maxRetries: 20,
    retryDelay: 2000, // 2 segundos
    statusCheckInterval: 2000,
    maxStatusChecks: 300
  },

  utils: {
    /**
     * Genera un hash aleatorio de 32 caracteres hexadecimales
     */
    hash: () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
    },

    /**
     * Codifica una cadena mediante XOR con 1
     */
    encoded: (str) => {
      if (!str || typeof str !== 'string') return '';
      let result = "";
      for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ 1);
      }
      return result;
    },

    /**
     * Codifica URL invirtiendo los códigos de caracteres
     */
    enc_url: (url, separator = ",") => {
      if (!url || typeof url !== 'string') return '';
      const codes = [];
      for (let i = 0; i < url.length; i++) {
        codes.push(url.charCodeAt(i));
      }
      return codes.join(separator).split(separator).reverse().join(separator);
    },

    /**
     * Valida si una cadena es una URL válida de YouTube
     */
    isValidYouTubeUrl: (str) => {
      if (!str || typeof str !== 'string') return false;
      try {
        const url = new URL(str);
        const hostname = url.hostname.toLowerCase();
        const validDomains = [
          /^(.+\.)?youtube\.com$/,
          /^(.+\.)?youtube-nocookie\.com$/,
          /^youtu\.be$/,
          /^(.+\.)?m\.youtube\.com$/
        ];
        return validDomains.some(pattern => pattern.test(hostname)) && 
               !url.searchParams.has("playlist");
      } catch (_) {
        return false;
      }
    },

    /**
     * Extrae el ID del video de una URL de YouTube
     */
    extractVideoId: (url) => {
      if (!url) return null;
      const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
        /^[a-zA-Z0-9_-]{11}$/ // ID directo
      ];
      
      for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1] || match[0];
      }
      return null;
    },

    /**
     * Formatea bytes a tamaño legible
     */
    formatBytes: (bytes, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * Sleep/delay promise
     */
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
  },

  // Métodos obsoletos mantenidos por compatibilidad
  isUrl: function(str) {
    return this.utils.isValidYouTubeUrl(str);
  },

  youtube: function(url) {
    return this.utils.extractVideoId(url);
  },

  /**
   * Realiza una petición HTTP a la API
   */
  request: async (endpoint, data = {}, method = 'post', customHeaders = {}) => {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Seleccionar endpoint aleatorio
        const endpoints = Object.values(ogmp3.api.endpoints);
        const selectedEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        
        const fullUrl = endpoint.startsWith('http') 
          ? endpoint 
          : `${selectedEndpoint}${endpoint}`;

        const config = {
          method,
          url: fullUrl,
          headers: { ...ogmp3.headers, ...customHeaders },
          timeout: ogmp3.config.requestTimeout,
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
        
        // No reintentar en errores 4xx
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }

        if (attempt < maxRetries) {
          await ogmp3.utils.sleep(1000 * attempt);
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

  /**
   * Verifica el estado de un trabajo de descarga
   */
  async checkStatus(id) {
    try {
      if (!id) throw new Error('ID is required');

      const hash1 = this.utils.hash();
      const hash2 = this.utils.hash();
      const encodedId = this.utils.encoded(id);
      const endpoint = `/${hash1}/status/${encodedId}/${hash2}/`;

      const response = await this.request(endpoint, { data: id });

      if (!response.status) {
        throw new Error(response.error || 'Status check failed');
      }

      return response;
    } catch (error) {
      return {
        status: false,
        code: 500,
        error: error.message
      };
    }
  },

  /**
   * Espera a que se complete el procesamiento del video
   */
  async checkProgress(data) {
    try {
      if (!data?.i) {
        throw new Error('Invalid data object');
      }

      let attempts = 0;
      const maxAttempts = ogmp3.config.maxStatusChecks;

      while (attempts < maxAttempts) {
        attempts++;

        const res = await this.checkStatus(data.i);
        
        if (!res.status) {
          await ogmp3.utils.sleep(ogmp3.config.statusCheckInterval);
          continue;
        }

        const stat = res.data;

        // Completado
        if (stat.s === "C") {
          return stat;
        }

        // En proceso
        if (stat.s === "P") {
          await ogmp3.utils.sleep(ogmp3.config.statusCheckInterval);
          continue;
        }

        // Error u otro estado
        if (stat.s === "E") {
          throw new Error(stat.e || 'Processing error');
        }

        // Estado desconocido
        return null;
      }

      throw new Error('Max status check attempts exceeded');
    } catch (error) {
      console.error('Progress check error:', error.message);
      return null;
    }
  },

  /**
   * Descarga un video o audio de YouTube
   */
  download: async (link, format, type = 'video') => {
    // Validación de parámetros
    if (!link) {
      return {
        status: false,
        code: 400,
        error: "❌ URL requerida. Proporciona un enlace de YouTube válido."
      };
    }

    if (!ogmp3.utils.isValidYouTubeUrl(link)) {
      return {
        status: false,
        code: 400,
        error: "❌ URL inválida. Asegúrate de proporcionar un enlace válido de YouTube."
      };
    }

    if (type !== 'video' && type !== 'audio') {
      return {
        status: false,
        code: 400,
        error: "❌ Tipo inválido. Debe ser 'video' o 'audio'.",
        available_types: ['video', 'audio']
      };
    }

    // Establecer formato por defecto si no se proporciona
    if (!format) {
      format = type === 'audio' ? ogmp3.default_fmt.audio : ogmp3.default_fmt.video;
    }

    // Validar formato
    const validFormats = type === 'audio' ? ogmp3.formats.audio : ogmp3.formats.video;
    if (!validFormats.includes(format.toString())) {
      return {
        status: false,
        code: 400,
        error: `❌ Formato ${format} no válido para ${type}.`,
        available_formats: validFormats
      };
    }

    // Extraer ID del video
    const videoId = ogmp3.utils.extractVideoId(link);
    if (!videoId) {
      return {
        status: false,
        code: 400,
        error: "❌ No se pudo extraer el ID del video de YouTube."
      };
    }

    try {
      let retries = 0;
      const maxRetries = ogmp3.config.maxRetries;

      while (retries < maxRetries) {
        retries++;

        const hash1 = ogmp3.utils.hash();
        const hash2 = ogmp3.utils.hash();
        
        const requestData = {
          data: ogmp3.utils.encoded(link),
          format: type === 'audio' ? "0" : "1",
          referer: "https://ogmp3.lat",
          mp3Quality: type === 'audio' ? format : null,
          mp4Quality: type === 'video' ? format : null,
          userTimeZone: new Date().getTimezoneOffset().toString()
        };

        const response = await ogmp3.request(
          `/${hash1}/init/${ogmp3.utils.enc_url(link)}/${hash2}/`,
          requestData
        );

        if (!response.status) {
          if (retries === maxRetries) {
            return {
              status: false,
              code: response.code,
              error: `❌ Error después de ${maxRetries} intentos: ${response.error}`
            };
          }
          await ogmp3.utils.sleep(ogmp3.config.retryDelay);
          continue;
        }

        const data = response.data;

        // Video demasiado largo
        if (data.le) {
          return {
            status: false,
            code: 400,
            error: "❌ El video es demasiado largo. Máximo permitido: 3 horas."
          };
        }

        // Límite de descargas alcanzado
        if (data.i === "blacklisted") {
          const timezone = new Date().getTimezoneOffset().toString();
          const limit = ogmp3.restrictedTimezones.has(timezone) ? 5 : 100;
          return {
            status: false,
            code: 429,
            error: `❌ Límite de descargas diarias (${limit}) alcanzado. Intenta más tarde.`
          };
        }

        // Video no existe o error
        if (data.e || data.i === "invalid") {
          return {
            status: false,
            code: 400,
            error: "❌ El video no existe, fue eliminado o está restringido."
          };
        }

        // Construcción del resultado base
        const buildResult = (statusData) => ({
          status: true,
          code: 200,
          result: {
            title: statusData.t || "Sin título",
            author: statusData.a || "Desconocido",
            type: type,
            format: format,
            quality: type === 'audio' ? `${format}kbps` : `${format}p`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            thumbnailHQ: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            thumbnailMQ: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            download: `${ogmp3.api.base}/${ogmp3.utils.hash()}/download/${ogmp3.utils.encoded(statusData.i)}/${ogmp3.utils.hash()}/`,
            videoId: videoId,
            url: link,
            duration: statusData.d || null,
            fileSize: statusData.fs ? ogmp3.utils.formatBytes(statusData.fs) : null,
            timestamp: new Date().toISOString()
          }
        });

        // Ya completado
        if (data.s === "C") {
          return buildResult(data);
        }

        // En proceso - esperar a que complete
        const progressResult = await ogmp3.checkProgress(data);
        
        if (progressResult && progressResult.s === "C") {
          return buildResult(progressResult);
        }

        // Si no se completó, reintentar
        if (retries < maxRetries) {
          await ogmp3.utils.sleep(ogmp3.config.retryDelay);
          continue;
        }
      }

      return {
        status: false,
        code: 500,
        error: `❌ No se pudo completar la descarga después de ${maxRetries} intentos.`
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

  /**
   * Obtiene información del video sin descargarlo
   */
  getInfo: async (link) => {
    if (!ogmp3.utils.isValidYouTubeUrl(link)) {
      return {
        status: false,
        code: 400,
        error: "❌ URL inválida"
      };
    }

    const videoId = ogmp3.utils.extractVideoId(link);
    if (!videoId) {
      return {
        status: false,
        code: 400,
        error: "❌ No se pudo extraer el ID del video"
      };
    }

    return {
      status: true,
      code: 200,
      result: {
        videoId: videoId,
        url: link,
        thumbnails: {
          maxres: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          hq: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          mq: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          sd: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
        },
        availableFormats: {
          video: ogmp3.formats.video,
          audio: ogmp3.formats.audio
        }
      }
    };
  }
};

export { ogmp3 };