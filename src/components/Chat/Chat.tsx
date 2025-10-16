import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Chat.css';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../types/global';
import { useDebounce, useDebouncedCallback } from '../../hooks/useDebounce';

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
  
  // Debounce del input para optimizar la experiencia del usuario
  const debouncedInputValue = useDebounce(inputValue, 300);
  
  // Estado para prevenir múltiples envíos rápidos
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Función optimizada de envío con debouncing y prevención de múltiples envíos
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Chat] handleSubmit called with inputValue:', inputValue);
    
    // Prevenir múltiples envíos rápidos
    if (!inputValue.trim() || isLoading || isSubmitting) {
      console.log('[Chat] Skipping submit - empty input, loading, or already submitting:', { 
        inputValue: inputValue.trim(), 
        isLoading, 
        isSubmitting 
      });
      return;
    }

    console.log('[Chat] About to call onSendMessage with:', inputValue);
    
    setIsSubmitting(true);
    try {
      await onSendMessage(inputValue.trim());
      console.log('[Chat] onSendMessage completed successfully');
      setInputValue('');
    } catch (error) {
      console.error('[Chat] Error in onSendMessage:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [inputValue, isLoading, isSubmitting, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log('[Chat] Key pressed:', e.key, 'with modifiers:', { ctrlKey: e.ctrlKey, metaKey: e.metaKey });
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      console.log('[Chat] Enter + Ctrl/Cmd detected, calling handleSubmit');
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
              disabled={!inputValue.trim() || isLoading || isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar'}
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
