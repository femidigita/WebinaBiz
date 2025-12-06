import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from '../types';

class GeminiService {
  private ai: GoogleGenAI;
  private chatSession: Chat | null = null;

  constructor() {
    const apiKey = process.env.API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async startChat(): Promise<void> {
    try {
      this.chatSession = this.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: `You are ZoomClone AI, an intelligent webinar assistant. 
          Your goal is to help users during their meeting. 
          You can suggest meeting agendas, summarize concepts, draft replies, or troubleshoot technical issues.
          Keep responses concise, professional, and helpful.`,
        },
      });
    } catch (error) {
      console.error("Failed to start Gemini chat session:", error);
    }
  }

  public async sendMessageStream(message: string, onChunk: (text: string) => void): Promise<string> {
    if (!this.chatSession) {
      await this.startChat();
    }

    if (!this.chatSession) {
        return "Error: AI Service unavailable.";
    }

    let fullResponse = "";
    try {
      const responseStream = await this.chatSession.sendMessageStream({ message });
      
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        const text = c.text || "";
        fullResponse += text;
        onChunk(fullResponse);
      }
    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      return "I'm having trouble connecting right now. Please try again.";
    }

    return fullResponse;
  }
}

export const geminiService = new GeminiService();