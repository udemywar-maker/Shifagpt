
import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from "@google/genai";
import { Character } from "../types.ts";

// Helper functions for audio encoding/decoding
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class GeminiService {
  private ai: GoogleGenAI;
  private chatSessions: Map<string, Chat> = new Map();
  private sessionPrompts: Map<string, string> = new Map();
  private audioContext: AudioContext | null = null;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  private getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return this.audioContext;
  }

  getChat(character: Character): Chat {
    const existingPrompt = this.sessionPrompts.get(character.id);
    
    if (this.chatSessions.has(character.id) && existingPrompt === character.systemPrompt) {
      return this.chatSessions.get(character.id)!;
    }

    const styleConstraints = `
      CONVERSATION STYLE:
      - Always respond as ${character.role} named ${character.name}.
      - Use casual, real-human texting style. 
      - Never use formal AI language like "I understand" or "As an AI".
      - Support the user's language (English, Urdu, etc.) automatically.
      - Stay concise and emotional.
    `;

    const chat = this.ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: character.systemPrompt + "\n\n" + styleConstraints,
        temperature: 0.9,
      },
    });

    this.chatSessions.set(character.id, chat);
    this.sessionPrompts.set(character.id, character.systemPrompt);
    return chat;
  }

  resetChat(characterId: string) {
    this.chatSessions.delete(characterId);
    this.sessionPrompts.delete(characterId);
  }

  async *sendMessageStream(character: Character, message: string) {
    const chat = this.getChat(character);
    try {
      const result = await chat.sendMessageStream({ message });
      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) yield c.text;
      }
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  }

  async speak(text: string, voiceName: string): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch (e) { console.warn("Audio Context blocked", e); }
    }

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (error) {
      console.error("Speech Error:", error);
    }
  }

  async generateAvatar(name: string, role: string, gender: string): Promise<string | null> {
    try {
      const prompt = `A professional, high-quality profile picture avatar for a character named ${name} who is a ${role}. 
      The character is ${gender}. 
      Style: Modern, clean, cinematic lighting, soft background, realistic but stylized. 
      The avatar should be centered and suitable for a chat application profile.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Avatar Generation Error:", error);
      return null;
    }
  }
}

export const geminiService = new GeminiService();
