import OpenAI from 'openai';

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
        temperature: 0.7,
        max_tokens: 2000,
      });

      return (
        completion.choices[0]?.message?.content ||
        'No se pudo obtener respuesta del LLM'
      );
    } catch (error) {
      console.error('Error al comunicarse con OpenAI:', error);
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
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }
    } catch (error) {
      console.error('Error en stream de OpenAI:', error);
      throw new Error(
        `Error de OpenAI Stream: ${error instanceof Error ? error.message : 'Error desconocido'}`
      );
    }
  }
}

// Función para crear una instancia del servicio
export function createOpenAIService(
  apiKey: string,
  model: string = 'gpt-3.5-turbo'
): OpenAIService {
  return new OpenAIService({ apiKey, model });
}
