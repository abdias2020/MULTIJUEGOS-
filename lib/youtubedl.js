import axios from 'axios';
import crypto from 'crypto';

const ogmp3 = {
  api: {
    base: "https://api3.apiapi.lat",
    endpoints: {
      a: "https://api5.apiapi.lat",
      b: "https://api.apiapi.lat",
      c: "https://api3.apiapi.lat"
    }
  },

  headers: {
    'authority': 'api.apiapi.lat',
    'content-type': 'application/json',
    'origin': 'https://ogmp3.lat',
    'referer': 'https://ogmp3.lat/',
    'user-agent': 'Postify/1.0.0'
  },

  formats: {
    video: ['240', '360', '480', '720', '1080'],
    audio: ['64', '96', '128', '192', '256', '320']
  },

  default_fmt: {
    video: '720',
    audio: '320'
  },

  restrictedTimezones: new Set(["-330", "-420", "-480", "-540"]),

  utils: {
    hash: () => crypto.randomBytes(16).toString('hex'),

    encoded: (str) => {
      let result = "";
      for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ 1);
      }
      return result;
    },

    enc_url: (url, separator = ",") => {
      const codes = Array.from(url).map(c => c.charCodeAt(0));
      return codes.join(separator).split(separator).reverse().join(separator);
    }
  },

  isUrl: str => {
    try {
      const url = new URL(str);
      const hostname = url.hostname.toLowerCase();
      const b = [/^(.+\.)?youtube\.com$/, /^(.+\.)?youtube-nocookie\.com$/, /^youtu\.be$/];
      return b.some(a => a.test(hostname)) && !url.searchParams.has("playlist");
    } catch (_) {
      return false;
    }
  },

  youtube: url => {
    if (!url) return null;
    const patterns = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
      const match = url.match(p);
      if (match) return match[1];
    }
    return null;
  },

  request: async (endpoint, data = {}, method = 'post') => {
    try {
      const endpoints = Object.values(ogmp3.api.endpoints);
      const base = endpoints[Math.floor(Math.random() * endpoints.length)];
      const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;

      const { data: response } = await axios({
        method,
        url,
        data: method === 'post' ? data : undefined,
        headers: ogmp3.headers
      });

      return { status: true, code: 200, data: response };
    } catch (error) {
      return { status: false, code: error.response?.status || 500, error: error.message };
    }
  },

  async checkStatus(id) {
    try {
      const c = this.utils.hash();
      const d = this.utils.hash();
      const endpoint = `/${c}/status/${this.utils.encoded(id)}/${d}/`;
      return await this.request(endpoint, { data: id });
    } catch (error) {
      return { status: false, code: 500, error: error.message };
    }
  },

  async checkProgress(data) {
    let attempts = 0;
    const maxAttempts = 300;

    while (attempts < maxAttempts) {
      attempts++;
      const res = await this.checkStatus(data.i);
      if (!res.status) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      const stat = res.data;
      if (stat.s === "C") return stat;
      if (stat.s === "P") await new Promise(r => setTimeout(r, 2000));
    }

    return null;
  },

  download: async (link, format, type = 'video') => {
    if (!link) return { status: false, code: 400, error: "Debes ingresar un link" };
    if (!ogmp3.isUrl(link)) return { status: false, code: 400, error: "Link inválido de YouTube" };
    if (!['audio', 'video'].includes(type)) return { status: false, code: 400, error: "Tipo debe ser audio o video" };

    format = format || (type === 'audio' ? ogmp3.default_fmt.audio : ogmp3.default_fmt.video);
    const validFmt = type === 'audio' ? ogmp3.formats.audio : ogmp3.formats.video;
    if (!validFmt.includes(format)) return { status: false, code: 400, error: `Formato inválido. Opciones: ${validFmt.join(', ')}` };

    const id = ogmp3.youtube(link);
    if (!id) return { status: false, code: 400, error: "No se pudo extraer la ID del video" };

    try {
      for (let retries = 0; retries < 20; retries++) {
        const c = ogmp3.utils.hash();
        const d = ogmp3.utils.hash();
        const req = {
          data: ogmp3.utils.encoded(link),
          format: type === 'audio' ? "0" : "1",
          referer: "https://ogmp3.cc",
          mp3Quality: type === 'audio' ? format : null,
          mp4Quality: type === 'video' ? format : null,
          userTimeZone: new Date().getTimezoneOffset().toString()
        };

        const resx = await ogmp3.request(`/${c}/init/${ogmp3.utils.enc_url(link)}/${d}/`, req);

        if (!resx.status) continue;
        const data = resx.data;

        if (data.le) return { status: false, code: 400, error: "Video demasiado largo (>3 horas)" };
        if (data.i === "blacklisted") {
          const limit = ogmp3.restrictedTimezones.has(new Date().getTimezoneOffset().toString()) ? 5 : 100;
          return { status: false, code: 429, error: `Límite diario alcanzado (${limit})` };
        }
        if (data.e || data.i === "invalid") return { status: false, code: 400, error: "Video no disponible o eliminado" };

        if (data.s === "C") {
          return {
            status: true,
            code: 200,
            result: {
              title: data.t || "Desconocido",
              type,
              format,
              thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
              download: `${ogmp3.api.base}/${ogmp3.utils.hash()}/download/${ogmp3.utils.encoded(data.i)}/${ogmp3.utils.hash()}/`,
              id,
              quality: format
            }
          };
        }

        const prod = await ogmp3.checkProgress(data);
        if (prod && prod.s === "C") {
          return {
            status: true,
            code: 200,
            result: {
              title: prod.t || "Desconocido",
              type,
              format,
              thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
              download: `${ogmp3.api.base}/${ogmp3.utils.hash()}/download/${ogmp3.utils.encoded(prod.i)}/${ogmp3.utils.hash()}/`,
              id,
              quality: format
            }
          };
        }
      }

      return { status: false, code: 500, error: "No se pudo completar la descarga tras varios intentos" };
    } catch (err) {
      return { status: false, code: 500, error: err.message };
    }
  }
};

export { ogmp3 };