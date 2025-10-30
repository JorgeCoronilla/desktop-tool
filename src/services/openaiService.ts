import OpenAI from 'openai';
import { logger } from './loggerService';

/**
 * Modelos disponibles de OpenAI
 * Actualizados con la serie GPT-5 (más reciente y eficiente)
 */
export const AVAILABLE_MODELS = {
  // GPT-5 Series (más reciente - recomendado)
  GPT_5: 'gpt-5',
  GPT_5_MINI: 'gpt-5-mini',
  GPT_5_NANO: 'gpt-5-nano',
  
  // GPT-4o Series (modelos actuales)
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',
  
  // Modelos legacy (para compatibilidad)
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo',
  GPT_3_5_TURBO: 'gpt-3.5-turbo'
} as const;

/**
 * Información de precios por modelo (USD por 1M tokens)
 * Basado en: https://platform.openai.com/docs/pricing
 */
export const MODEL_PRICING = {
  [AVAILABLE_MODELS.GPT_5]: { input: 1.25, output: 10.00 },
  [AVAILABLE_MODELS.GPT_5_MINI]: { input: 0.25, output: 2.00 },
  [AVAILABLE_MODELS.GPT_5_NANO]: { input: 0.05, output: 0.40 },
  [AVAILABLE_MODELS.GPT_4O]: { input: 2.50, output: 10.00 },
  [AVAILABLE_MODELS.GPT_4O_MINI]: { input: 0.15, output: 0.60 }
} as const;

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export class OpenAIService {
  private openai: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
    });
    this.model = config.model;
  }

  async sendMessage(messages: ChatMessage[]): Promise<string> {
    try {
      const openaiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        temperature: 1,
        max_completion_tokens: 2000,
      });

      return (
        completion.choices[0]?.message?.content ||
        'No se pudo obtener respuesta del LLM'
      );
    } catch (error) {
      logger.error('Error communicating with OpenAI', error);
      throw new Error(
        `Error de OpenAI: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
    }
  }

  async sendMessageStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      const openaiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        temperature: 1,
        max_completion_tokens: 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }
    } catch (error) {
      logger.error('Error in OpenAI stream', error);
      throw new Error(
        `Error de OpenAI Stream: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
    }
  }
}

// Función para crear una instancia del servicio
export function createOpenAIService(
  apiKey: string,
  model: string = AVAILABLE_MODELS.GPT_5 // GPT-5 como modelo por defecto (más eficiente y económico)
): OpenAIService {
  return new OpenAIService({ apiKey, model });
}
