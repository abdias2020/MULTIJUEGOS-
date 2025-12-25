import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import WebSocket from 'ws'

import { blackboxAi } from '../lib/scraper.js'
import { db } from '../lib/postgres.js'
import { ask as geminiAsk, askForImages as geminiAskImages } from '../lib/gemini-scraper.js'

/* ======================== CONFIG IA NV ======================== */
const NV_CHATGPT_BASE = 'https://api-nv.ultraplus.click'
const NV_CHATGPT_KEY = 'RrSyVm056GfAhjuM'

/* ======================== COPILOT CLASS ======================== */
class Copilot {
  constructor () {
    this.conversationId = null
    this.models = {
      default: 'chat',
      'think-deeper': 'reasoning',
      'gpt-5': 'smart'
    }
    this.headers = {
      origin: 'https://copilot.microsoft.com',
      'user-agent':
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
    }
  }

  async createConversation () {
    const { data } = await axios.post(
      'https://copilot.microsoft.com/c/api/conversations',
      null,
      { headers: this.headers }
    )
    this.conversationId = data.id
    return data.id
  }

  async chat (message, { model = 'default' } = {}) {
    if (!this.conversationId) await this.createConversation()
    if (!this.models[model]) {
      throw new Error(
        `Modelos disponibles: ${Object.keys(this.models).join(', ')}`
      )
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        'wss://copilot.microsoft.com/c/api/chat?api-version=2&ncedge=1',
        { headers: this.headers }
      )

      const response = { text: '' }

      ws.on('open', () => {
        ws.send(JSON.stringify({ event: 'setOptions' }))
        ws.send(
          JSON.stringify({
            event: 'send',
            mode: this.models[model],
            conversationId: this.conversationId,
            content: [{ type: 'text', text: message }],
            context: {}
          })
        )
      })

      ws.on('message', msg => {
        const data = JSON.parse(msg.toString())

        if (data.event === 'appendText') {
          response.text += data.text || ''
        }

        if (data.event === 'done') {
          ws.close()
          resolve(response)
        }

        if (data.event === 'error') {
          ws.close()
          reject(new Error(data.message || 'Error Copilot'))
        }
      })

      ws.on('error', err => {
        ws.close()
        reject(err)
      })
    })
  }
}

/* ======================== HANDLER ======================== */
const handler = async (m, { conn, text, usedPrefix, command }) => {
  const username = m.pushName || 'Usuario'

  const formatForWhatsApp = txt =>
    txt
      .replace(/\\([!?.,"'])/g, '$1')
      .replace(/\*\*/g, '*')
      .replace(/\_\_/g, '_')
      .replace(/\\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

  /* ======================== CHATGPT NV (FIX REAL) ======================== */
  async function chatgptNV (prompt) {
    const u = new URL('/api/ai/chatgpt', NV_CHATGPT_BASE)
    u.search = new URLSearchParams({
      text: prompt,
      key: NV_CHATGPT_KEY
    })

    const r = await fetch(u.toString())
    if (!r.ok) throw new Error(`HTTP ${r.status}`)

    const data = await r.json()

    if (!data.status) throw new Error('La API NV respondió con error')
    if (!data.txt) throw new Error('Respuesta vacía de ChatGPT')

    return data.txt
  }

  if (command === 'ia' && !text) {
    return m.reply(
      `🤖 *¿Qué IA deseas usar?*\n\n` +
      `1️⃣ ChatGPT\n2️⃣ Gemini\n3️⃣ Copilot\n\n` +
      `👉 Ejemplo:\n${usedPrefix}ia chatgpt Hola`
    )
  }

  if (command === 'ia') {
    const [iaType, ...rest] = text.split(' ')
    const prompt = rest.join(' ').trim()
    if (!prompt) return m.reply('❌ Escribe una pregunta válida')

    await conn.sendPresenceUpdate('composing', m.chat)

    try {
      if (/^chatgpt$/i.test(iaType)) {
        const res = await chatgptNV(prompt)
        return m.reply(formatForWhatsApp(res))
      }

      if (/^gemini$/i.test(iaType)) {
        const result = await geminiAskImages(prompt, null)
        await m.reply(formatForWhatsApp(result.text))

        if (result.savedFiles?.length) {
          for (const img of result.savedFiles) {
            await conn.sendMessage(
              m.chat,
              { image: { url: img }, caption: '🖼️ Imagen generada por Gemini' },
              { quoted: m }
            )
            try { fs.unlinkSync(img) } catch {}
          }
        }
        return
      }

      if (/^(copilot|bing)$/i.test(iaType)) {
        const copilot = new Copilot()
        const res = await copilot.chat(prompt)
        return m.reply(formatForWhatsApp(res.text))
      }

      return m.reply('❌ IA no válida')
    } catch (e) {
      return m.reply(`❌ Error IA:\n${e.message}`)
    }
  }

  if (/^blackbox$/i.test(command)) {
    const result = await blackboxAi(text)
    if (result.status) return m.reply(result.data.response)
    return m.reply('❌ Error Blackbox')
  }
}

/* ======================== METADATA ======================== */
handler.help = ['ia', 'chatgpt', 'gemini', 'copilot', 'blackbox']
handler.tags = ['buscadores']
handler.command = /^(ia|chatgpt|gemini|copilot|bing|blackbox)$/i

export default handler