import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import './Chat.css';
import { ChatMessage } from '../../types/global';
import { useDebounce, useDebouncedCallback } from '../../hooks/useDebounce';
import { logger } from '../../services/loggerService';

// Lazy loading de ReactMarkdown para reducir el bundle inicial
const ReactMarkdown = React.lazy(() => import('react-markdown'));

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onCancel: () => void;
  tokenLimit: number;
  onChangeTokenLimit: (n: number) => void;
}

// Componente optimizado para mensajes individuales
const MessageItem = React.memo<{
  message: ChatMessage;
  formatTime: (date: Date) => string;
}>(({ message, formatTime }) => (
  <div
    className={`message ${
      message.role === 'user' ? 'user-message' : 'assistant-message'
    }`}
  >
    <div className={'message-content'}>
      <Suspense fallback={<div>Cargando mensaje...</div>}>
        <ReactMarkdown>
          {message.content}
        </ReactMarkdown>
      </Suspense>
    </div>
    <div className={'message-time'}>
      {formatTime(message.timestamp)}
    </div>
  </div>
));

MessageItem.displayName = 'MessageItem';

const Chat: React.FC<ChatProps> = React.memo(({
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
  
  // Estado para prevenir múltiples envíos rápidos
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debouncing para optimizar el rendimiento
  const debouncedInputValue = useDebounce(inputValue, 150);
  const debouncedTokenLimit = useDebounce(tokenLimit, 300);

  // Callback debounced para cambios de token limit
  const debouncedOnChangeTokenLimit = useDebouncedCallback(
    (value: number) => onChangeTokenLimit(value),
    300
  );

  // Usamos clases globales, no CSS Modules

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    
    // Función recursiva para intentar scroll hasta que funcione
    const attemptScroll = (attempts = 0) => {
      if (attempts > 10) return; // Máximo 10 intentos
      
      const { scrollTop, scrollHeight, clientHeight } = el;
      const targetScrollTop = scrollHeight - clientHeight;
      
      // Si ya estamos en el final, no hacer nada
      if (Math.abs(scrollTop - targetScrollTop) < 5) return;
      
      el.scrollTop = targetScrollTop;
      
      // Verificar si el scroll funcionó, si no, intentar de nuevo
      requestAnimationFrame(() => {
        const newScrollTop = el.scrollTop;
        if (Math.abs(newScrollTop - targetScrollTop) > 5) {
          attemptScroll(attempts + 1);
        }
      });
    };
    
    // Usar múltiples estrategias para asegurar el scroll
    requestAnimationFrame(() => {
      attemptScroll();
      
      // Backup: intentar de nuevo después de un pequeño delay
      setTimeout(() => attemptScroll(), 50);
      setTimeout(() => attemptScroll(), 100);
    });
  }, []);

  // Efecto principal para manejar nuevos mensajes
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) {
      // Si no hay elemento, intentar hacer scroll después de que se monte
      setTimeout(scrollToBottom, 100);
      return;
    }
    
    // Verificar si estamos cerca del final antes de la actualización
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    const nearBottomThreshold = 120;
    const wasNearBottom = distanceToBottom <= nearBottomThreshold;
    
    // Actualizar el estado de isNearBottom
    setIsNearBottom(wasNearBottom);
    
    // Si estamos cerca del final o es el primer mensaje, hacer scroll
    if (wasNearBottom || messages.length === 1) {
      // Usar múltiples timeouts para manejar diferentes tiempos de renderizado
      setTimeout(scrollToBottom, 0);
      setTimeout(scrollToBottom, 50);
      setTimeout(scrollToBottom, 150);
      setTimeout(scrollToBottom, 300);
    }
  }, [messages, scrollToBottom]);

  // Efecto adicional para manejar cambios en el estado de carga
  useEffect(() => {
    if (!isLoading && isNearBottom) {
      // Cuando termina la carga y estamos cerca del final, hacer scroll
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
    }
  }, [isLoading, isNearBottom, scrollToBottom]);

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
    logger.debug('Chat handleSubmit called', { inputValue });
    
    // Prevenir múltiples envíos rápidos
    if (!inputValue.trim() || isLoading || isSubmitting) {
      logger.debug('Chat skipping submit', { 
        inputValue: inputValue.trim(), 
        isLoading, 
        isSubmitting 
      });
      return;
    }

    logger.debug('Chat about to call onSendMessage', { inputValue });
    
    setIsSubmitting(true);
    try {
      await onSendMessage(inputValue.trim());
      logger.debug('Chat onSendMessage completed successfully');
      setInputValue('');
    } catch (error) {
      logger.error('Chat error in onSendMessage', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [inputValue, isLoading, isSubmitting, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    logger.debug('Chat key pressed', { 
      key: e.key, 
      modifiers: { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey } 
    });
    
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      logger.debug('Chat Enter detected, calling handleSubmit');
      e.preventDefault();
      handleSubmit(e as any);
    }
  }, [handleSubmit]);

  // Memoizar la función formatTime para evitar recreaciones
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Memoizar la lista de mensajes renderizados
  const renderedMessages = useMemo(() => {
    return messages.map(message => (
      <MessageItem
        key={message.id}
        message={message}
        formatTime={formatTime}
      />
    ));
  }, [messages, formatTime]);

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
          renderedMessages
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
            aria-label="Ir al final del chat"
            title="Ir al final del chat"
          >
            ↓
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
              disabled={!debouncedInputValue.trim() || isLoading || isSubmitting}
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
                  debouncedOnChangeTokenLimit(parseInt(e.target.value || '0', 10))
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
});

Chat.displayName = 'Chat';

export default Chat;