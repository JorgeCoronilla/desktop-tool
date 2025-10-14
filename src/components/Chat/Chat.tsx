import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../types/global';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onCancel: () => void;
  tokenLimit: number;
  onChangeTokenLimit: (n: number) => void;
}

const Chat: React.FC<ChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onCancel,
  tokenLimit,
  onChangeTokenLimit,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  // Usamos clases globales, no CSS Modules

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight; // asegura scroll sólo dentro del contenedor de mensajes
  };

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) {
      scrollToBottom();
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    const nearBottomThreshold = 120; // px
    const nearBottom = distanceToBottom <= nearBottomThreshold;
    setIsNearBottom(nearBottom);
    if (nearBottom) scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottomThreshold = 120; // px
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
      setIsNearBottom(distanceToBottom <= nearBottomThreshold);
    };
    el.addEventListener('scroll', handleScroll);
    // Initialize state
    handleScroll();
    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={'chat-container'}>
      <div className={'messages-container'} ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className={'empty-state'}>
            ¡Hola! Soy tu asistente para operaciones de archivos.
            <br />
            Selecciona una carpeta y pregúntame qué necesitas hacer.
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`message ${
                message.role === 'user' ? 'user-message' : 'assistant-message'
              }`}
            >
              <div className={'message-content'}>
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
              <div className={'message-time'}>
                {formatTime(message.timestamp)}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className={'loading-indicator'}>
            <span className={'loading-dots'}>Pensando...</span>
          </div>
        )}

        <div ref={messagesEndRef} />

        {!isNearBottom && messages.length > 0 && (
          <button
            type="button"
            className={'scrollToBottomButton'}
            onClick={scrollToBottom}
            aria-label="Ir al final"
            title="Ir al final"
          >
            ↓ Ir al final
          </button>
        )}
      </div>

      <div className={'input-container'}>
        <form onSubmit={handleSubmit} className={'input-form'}>
          <textarea
            className={'message-input'}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)"
            disabled={isLoading}
            rows={3}
          />
          <div className={'actions-column'}>
            <button
              type="submit"
              className={'send-button'}
              disabled={!inputValue.trim() || isLoading}
            >
              Enviar
            </button>
            {isLoading ? (
              <button
                type="button"
                className={'send-button send-button--danger'}
                onClick={onCancel}
              >
                Cancelar
              </button>
            ) : (
              <input
                type="number"
                min={100}
                max={4096}
                step={50}
                value={tokenLimit}
                onChange={e =>
                  onChangeTokenLimit(parseInt(e.target.value || '0', 10))
                }
                title="Límite de tokens"
                className={'token-input actions-token-input'}
              />
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Chat;
