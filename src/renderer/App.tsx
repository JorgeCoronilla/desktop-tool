import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import {
  AppState,
  FileItem,
  ChatMessage,
  PreloadChatMessage,
  OpenAIResponse,
  OpenAIConfig,
  TaskState,
} from '../types/global';
import { toolManager, ToolCall, ToolResponse } from '../tools/toolManager';

const SYSTEM_PROMPT = `Eres un asistente amigable para gestión de archivos y documentos. Usa el sistema de estado de tareas para gestionar el flujo.

FORMATO OBLIGATORIO:
[TOOL:nombre_herramienta]({"parametro":"valor"})

FLUJO DE ESTADO DE TAREAS - EJECUTA TODO EN UNA SOLA RESPUESTA:
1. Siempre inicia con [TOOL:get_task_state]() para verificar el estado actual
2. Si está IDLE, actualiza a IN_PROGRESS: [TOOL:update_task_state]({"state":"IN_PROGRESS"})
3. Ejecuta las herramientas necesarias para completar la tarea
4. Al finalizar, actualiza a COMPLETED: [TOOL:update_task_state]({"state":"COMPLETED"})

REGLAS CRÍTICAS:
- EJECUTA TODAS LAS HERRAMIENTAS EN UNA SOLA RESPUESTA
- USA <CWD> para rutas de archivos
- JSON válido con comillas dobles
- Sigue SIEMPRE el flujo de estados COMPLETO
- NO te detengas hasta completar TODA la secuencia
- Para update_task_state: solo 'state' es requerido, otros parámetros son opcionales
- Una tarea está completa cuando el estado es COMPLETED
- Muestra mensajes amigables y útiles al usuario, evita información técnica innecesaria

EJEMPLO COMPLETO para "Crea archivo jorge con lista de acciones":
[TOOL:get_task_state]()
[TOOL:update_task_state]({"state":"IN_PROGRESS"})
[TOOL:write_text_file]({"filePath":"<CWD>/jorge.txt","content":"Lista de acciones disponibles:\n1. Leer archivos\n2. Escribir archivos\n3. Crear directorios\n4. Eliminar archivos\n5. Copiar archivos\n6. Mover archivos\n7. Listar directorios"})
[TOOL:update_task_state]({"state":"COMPLETED"})

IMPORTANTE: Ejecuta TODAS estas herramientas en tu respuesta. El bucle se detiene automáticamente cuando el estado es COMPLETED.`;

const App: React.FC = () => {
  console.log('App component rendering...');
  console.log('window.electronAPI:', window.electronAPI);

  const [appState, setAppState] = useState<AppState>({
    currentFolder: null,
    files: [],
    chatMessages: [],
    isChatLoading: false,
    isFileLoading: false,
    taskContext: {
      state: TaskState.IDLE,
      description: '',
      currentStep: '',
      completedSteps: 0,
      lastAction: '',
      needsConfirmation: false,
    },
  });

  const [openaiConfig, setOpenaiConfig] = useState<OpenAIConfig | null>(null);
  const [isOpenAIInitialized, setIsOpenAIInitialized] = useState(false);
  const [tokenLimit, setTokenLimit] = useState<number>(4000);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  // Verificar configuración de OpenAI al cargar
  useEffect(() => {
    const checkOpenAIConfig = async () => {
      // Si estamos en preview del navegador, window.electronAPI no existe
      if (!(window as any).electronAPI) {
        console.warn('electronAPI no disponible: ejecutando en modo web');
        const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        // En modo web usaremos un proxy backend local en lugar de exponer API key
        setOpenaiConfig({ hasApiKey: true, model, isInitialized: true });
        setIsOpenAIInitialized(true);

        const welcomeMessage: ChatMessage = {
          id: 'welcome-web',
          content:
            'Estás usando la versión web. Usaré un proxy local para comunicarme con OpenAI sin exponer tu API key en el navegador.',
          role: 'assistant',
          timestamp: new Date(),
        };

        // // Cargar datos mock para estilado del FileExplorer
        // const { MOCK_ROOT, MOCK_TREE } = await import('../components/FileExplorer/mockData');
        // setAppState(prev => ({
        //   ...prev,
        //   chatMessages: [welcomeMessage],
        //   currentFolder: MOCK_ROOT,
        //   files: MOCK_TREE[MOCK_ROOT] || [],
        // }));
        // Comentado: retiramos mock en modo web; dejamos mensaje de bienvenida
        setAppState(prev => ({
          ...prev,
          chatMessages: [welcomeMessage],
        }));
        return;
      }

      try {
        // Validar que el preload expone el método esperado
        if (
          typeof (window as any).electronAPI.checkOpenAIConfig !== 'function'
        ) {
          console.warn(
            'electronAPI.checkOpenAIConfig no es una función: posible desajuste de preload.'
          );
          // Mensaje informativo para guiar al usuario
          const infoMessage: ChatMessage = {
            id: 'preload-mismatch',
            content:
              'Detecté que el preload no expone checkOpenAIConfig. Recompila el proceso principal (npm run build:main) y reinicia Electron (npm run dev:main).',
            role: 'assistant',
            timestamp: new Date(),
          };
          setAppState(prev => ({
            ...prev,
            chatMessages: [...prev.chatMessages, infoMessage],
          }));
          setOpenaiConfig({
            hasApiKey: false,
            model: 'unknown',
            isInitialized: false,
          });
          setIsOpenAIInitialized(false);
          return;
        }

        const config = await window.electronAPI.checkOpenAIConfig();
        setOpenaiConfig(config);

        if (config.hasApiKey && !config.isInitialized) {
          // Intentar inicializar automáticamente si hay API key
          if (typeof (window as any).electronAPI.initOpenAI !== 'function') {
            console.warn(
              'electronAPI.initOpenAI no es una función: posible desajuste de preload.'
            );
            const infoMessage: ChatMessage = {
              id: 'preload-mismatch-init',
              content:
                'El preload no expone initOpenAI. Recompila el main (npm run build:main) y reinicia Electron (npm run dev:main).',
              role: 'assistant',
              timestamp: new Date(),
            };
            setAppState(prev => ({
              ...prev,
              chatMessages: [...prev.chatMessages, infoMessage],
            }));
            setIsOpenAIInitialized(false);
            return;
          }

          const initResult = await window.electronAPI.initOpenAI();
          setIsOpenAIInitialized(initResult.success);

          if (initResult.success) {
            // Agregar mensaje de bienvenida
            const welcomeMessage: ChatMessage = {
              id: 'welcome',
              content:
                '¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte hoy?',
              role: 'assistant',
              timestamp: new Date(),
            };

            setAppState(prev => ({
              ...prev,
              chatMessages: [welcomeMessage],
            }));
          }
        } else {
          setIsOpenAIInitialized(!!config.isInitialized);
        }
      } catch (error) {
        console.error('Error checking OpenAI config:', error);
      }
    };

    checkOpenAIConfig();
  }, []);

  const handleFolderSelect = async () => {
    try {
      setAppState(prev => ({ ...prev, isFileLoading: true }));
      if (!(window as any).electronAPI) {
        const msg: ChatMessage = {
          id: (Date.now() + 2).toString(),
          content:
            'Seleccionar carpeta requiere la app Electron. En preview del navegador no está disponible.',
          role: 'assistant',
          timestamp: new Date(),
        };
        setAppState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages, msg],
          isFileLoading: false,
        }));
        return;
      }
      const folderPath = await window.electronAPI.selectFolder();

      if (folderPath) {
        const files = await window.electronAPI.readDirectory(folderPath);
        setAppState(prev => ({
          ...prev,
          currentFolder: folderPath,
          files,
          isFileLoading: false,
        }));
      } else {
        setAppState(prev => ({ ...prev, isFileLoading: false }));
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      setAppState(prev => ({ ...prev, isFileLoading: false }));
    }
  };

  const handleNavigateToFolder = async (folderPath: string) => {
    try {
      setAppState(prev => ({ ...prev, isFileLoading: true }));
      if (!(window as any).electronAPI) {
        const msg: ChatMessage = {
          id: (Date.now() + 3).toString(),
          content:
            'Navegar entre carpetas requiere la app Electron. En preview del navegador no está disponible.',
          role: 'assistant',
          timestamp: new Date(),
        };
        setAppState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages, msg],
          isFileLoading: false,
        }));
        return;
      }
      const files = await window.electronAPI.readDirectory(folderPath);
      setAppState(prev => ({
        ...prev,
        currentFolder: folderPath,
        files,
        isFileLoading: false,
      }));
    } catch (error) {
      console.error('Error navigating to folder:', error);
      setAppState(prev => ({ ...prev, isFileLoading: false }));
    }
  };

  const handleNavigateBack = async () => {
    if (!appState.currentFolder) return;

    const parentPath = appState.currentFolder.split('/').slice(0, -1).join('/');
    if (parentPath) {
      await handleNavigateToFolder(parentPath);
    }
  };

  const handleSendMessage = async (content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setAppState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, newMessage],
      isChatLoading: true,
    }));

    // Atajo: si el usuario escribe solo "confirm", ejecutamos la última llamada destructiva pendiente
    const isConfirmOnly = (content || '').trim().toLowerCase() === 'confirm';
    if (isConfirmOnly) {
      try {
        const { processedMessage, toolCalls, responses } =
          await toolManager.processLLMMessage('confirm', {
            cwd: appState.currentFolder || undefined,
          });
        const finalContent =
          processedMessage && processedMessage.trim().length > 0
            ? processedMessage
            : 'Lo siento, no puedo ayudarte.';
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: finalContent,
          role: 'assistant',
          timestamp: new Date(),
        };
        setAppState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages, assistantMessage],
          isChatLoading: false,
        }));
        await refreshCurrentFolderIfChanged(toolCalls, responses);
        return;
      } catch (e) {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          content: `❌ Error al confirmar: ${e instanceof Error ? e.message : 'Error desconocido'}`,
          role: 'assistant',
          timestamp: new Date(),
        };
        setAppState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages, errorMessage],
          isChatLoading: false,
        }));
        return;
      }
    }

    // Helper: refrescar el árbol si alguna herramienta modifica el sistema de archivos
    async function refreshCurrentFolderIfChanged(
      toolCalls: ToolCall[],
      responses: ToolResponse[]
    ) {
      try {
        if (!(window as any).electronAPI) return; // Solo aplica en Electron
        if (!appState.currentFolder) return;
        const mutateSet = new Set([
          'create_directory',
          'delete_file_or_directory',
          'move_file_or_directory',
          'copy_file_or_directory',
          'write_text_file',
          'write_excel',
          'modify_excel',
        ]);
        const shouldRefresh = responses.some((res, i) => {
          const call = toolCalls[i];
          return res.success && !!call && mutateSet.has(call.name);
        });
        if (shouldRefresh) {
          const files = await window.electronAPI.readDirectory(
            appState.currentFolder
          );
          setAppState(prev => ({ ...prev, files }));
        }
      } catch (e) {
        // noop
      }
    }

    try {
      // Si estamos en preview del navegador, no hay electronAPI disponible
      if (!(window as any).electronAPI) {
        const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

        // Convertir mensajes al formato de OpenAI + prompt de sistema
        const toolsDoc = toolManager.generateToolsDocumentation();
        console.log('🔧 DEBUG: Documentación de herramientas:', toolsDoc);
        const openaiMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: toolsDoc },
          ...(appState.currentFolder
            ? [
                {
                  role: 'system',
                  content: `Carpeta de trabajo actual: ${appState.currentFolder}`,
                },
              ]
            : []),
          ...[...appState.chatMessages, newMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        ];
        
        console.log('📤 DEBUG: Mensajes enviados a OpenAI:', openaiMessages);

        try {
          // Crear mensaje del asistente vacío para ir rellenando con el stream
          const assistantId = (Date.now() + 1).toString();
          const assistantInitial: ChatMessage = {
            id: assistantId,
            content: '',
            role: 'assistant',
            timestamp: new Date(),
          };
          setAppState(prev => ({
            ...prev,
            chatMessages: [...prev.chatMessages, assistantInitial],
          }));
          const controller = new AbortController();
          setAbortController(controller);
          const res = await fetch('http://localhost:4000/api/chat-stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: openaiMessages,
              maxTokens: tokenLimit,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
          }

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              accumulated += chunk;
              // Actualizar el último mensaje del asistente con el contenido acumulado
              setAppState(prev => {
                const msgs = [...prev.chatMessages];
                const idx = msgs.findIndex(m => m.id === assistantId);
                if (idx >= 0) {
                  msgs[idx] = { ...msgs[idx], content: accumulated };
                }
                return { ...prev, chatMessages: msgs };
              });
            }
          } else {
            // Fallback si el navegador no soporta streams en fetch
            const text = await res.text();
            accumulated = text;
            setAppState(prev => {
              const msgs = [...prev.chatMessages];
              const idx = msgs.findIndex(m => m.id === assistantId);
              if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], content: accumulated };
              }
              return { ...prev, chatMessages: msgs };
            });
          }

          // Postprocesar la respuesta del asistente para ejecutar herramientas si las solicitó
          console.log('[App] Respuesta completa del LLM:', accumulated);
          const { processedMessage, toolCalls, responses } =
            await toolManager.processLLMMessage(accumulated, {
              cwd: appState.currentFolder || undefined,
            });
          setAppState(prev => {
            const msgs = [...prev.chatMessages];
            const idx = msgs.findIndex(m => m.id === assistantId);
            if (idx >= 0) {
              const finalContent =
                processedMessage && processedMessage.trim().length > 0
                  ? processedMessage
                  : 'Lo siento, no puedo ayudarte.';
              msgs[idx] = { ...msgs[idx], content: finalContent };
            }
            return { ...prev, chatMessages: msgs };
          });

          // En modo web normalmente no hay electronAPI; el helper hará guardas
          await refreshCurrentFolderIfChanged(toolCalls, responses);

          setAppState(prev => ({ ...prev, isChatLoading: false }));
          setAbortController(null);
          return;
        } catch (err) {
          const errorMessage: ChatMessage = {
            id: (Date.now() + 2).toString(),
            content: `❌ Error al llamar a OpenAI en web: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            role: 'assistant',
            timestamp: new Date(),
          };
          setAppState(prev => ({
            ...prev,
            chatMessages: [...prev.chatMessages, errorMessage],
            isChatLoading: false,
          }));
          setAbortController(null);
          return;
        }
      }

      if (!isOpenAIInitialized) {
        // Si OpenAI no está inicializado, mostrar mensaje de configuración
        const configMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: `❌ OpenAI no está configurado. 

Para usar el chat con IA, necesitas:
1. Agregar tu API key de OpenAI al archivo .env
2. Reiniciar la aplicación

Archivo .env debe contener:
OPENAI_API_KEY=tu_api_key_aqui
OPENAI_MODEL=gpt-3.5-turbo

${openaiConfig?.hasApiKey ? 'API key detectada pero hay un error de inicialización.' : 'No se encontró API key en las variables de entorno.'}`,
          role: 'assistant',
          timestamp: new Date(),
        };

        setAppState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages, configMessage],
          isChatLoading: false,
        }));
        return;
      }

      // Convertir mensajes al formato de OpenAI con tipado explícito
      const historyMessages: PreloadChatMessage[] =
        appState.chatMessages.map<PreloadChatMessage>(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const toolsDoc = toolManager.generateToolsDocumentation();
      const openaiMessages: PreloadChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT } as PreloadChatMessage,
        { role: 'system', content: toolsDoc } as PreloadChatMessage,
        ...(appState.currentFolder
          ? [
              {
                role: 'system',
                content: `Carpeta de trabajo actual: ${appState.currentFolder}`,
              } as PreloadChatMessage,
            ]
          : []),
        ...historyMessages,
      ];

      // Agregar el nuevo mensaje del usuario
      openaiMessages.push({ role: 'user', content } as PreloadChatMessage);

      // Orquestación simplificada: usar sistema de estado de tareas
      const userGoal = content;
      let iteration = 0;
      let continueLoop = true;
      let lastMessages = openaiMessages.slice();
      let finalAssistantContent = '';

      console.log(`🔍 DEBUG: Iniciando nueva solicitud "${userGoal}" con sistema de estado`);

      while (continueLoop && iteration < 10) {
        console.log(`🔍 DEBUG: Enviando mensajes a OpenAI (iteración ${iteration}):`, lastMessages);
        const response =
          await window.electronAPI.sendMessageToOpenAI(lastMessages);
        
        console.log(`🔍 DEBUG: Respuesta COMPLETA de OpenAI:`, JSON.stringify(response, null, 2));
        console.log(`🔍 DEBUG: Contenido de la respuesta:`, response?.response || 'SIN CONTENIDO');
        
        let responseContent = '';
        if (response.success && response.response) {
          responseContent = response.response;
          console.log(`🔍 DEBUG: Respuesta del LLM (iteración ${iteration}):`, responseContent);
        } else {
          responseContent = `❌ Error al obtener respuesta: ${response.message || 'Error desconocido'}`;
          console.log(`🔍 DEBUG: Error en respuesta del LLM:`, response);
        }

        const { processedMessage, toolCalls, responses } =
          await toolManager.processLLMMessage(responseContent, {
            cwd: appState.currentFolder || undefined,
          });

        const finalContent =
          processedMessage && processedMessage.trim().length > 0
            ? processedMessage
            : 'Lo siento, no puedo ayudarte.';

        await refreshCurrentFolderIfChanged(toolCalls, responses);

        // Actualizar el contenido final del asistente
        finalAssistantContent = finalContent;

        // Obtener el estado actual de la tarea desde las herramientas ejecutadas
        let currentTaskState = TaskState.IDLE;
        let needsConfirmation = false;
        
        // Buscar si se ejecutó get_task_state o update_task_state
         for (let i = 0; i < toolCalls.length; i++) {
           const toolCall = toolCalls[i];
           const response = responses[i];
           
           console.log(`🔍 DEBUG: Herramienta: ${toolCall.name}, Response:`, response);
           
           if (toolCall.name === 'get_task_state' && response.success && response.result && response.result.data) {
             currentTaskState = response.result.data.state;
             needsConfirmation = response.result.data.needsConfirmation || false;
             console.log(`🔍 DEBUG: Estado obtenido: ${currentTaskState}, Confirmación: ${needsConfirmation}`);
           } else if (toolCall.name === 'update_task_state' && response.success) {
             // El estado se actualizó, usar el estado del parámetro
             currentTaskState = toolCall.parameters.state as TaskState;
             needsConfirmation = toolCall.parameters.needsConfirmation || false;
             console.log(`🔍 DEBUG: Estado actualizado: ${currentTaskState}, Confirmación: ${needsConfirmation}`);
           }
         }

        // Lógica corregida de continuación basada en el estado
        const shouldStop = 
          currentTaskState === TaskState.COMPLETED ||
          currentTaskState === TaskState.FAILED ||
          currentTaskState === TaskState.AWAITING_CONFIRMATION;

        const shouldContinue = 
          (currentTaskState === TaskState.IN_PROGRESS && toolCalls.length > 0) ||
          (currentTaskState === TaskState.IDLE && iteration <= 2); // Permitir múltiples iteraciones cuando está idle para procesar la tarea

        console.log(`🔍 DEBUG: Iteración ${iteration} - Estado: ${currentTaskState}, Continuar: ${shouldContinue}, Parar: ${shouldStop}`);

        if (shouldStop) {
          console.log(`🔍 DEBUG: Deteniendo loop - Estado: ${currentTaskState}`);
          continueLoop = false;
          break;
        }

        if (!shouldContinue) {
          console.log(`🔍 DEBUG: No hay más acciones que realizar - Estado: ${currentTaskState}`);
          continueLoop = false;
          break;
        }

        // Preparar siguiente iteración
        const historyMessagesNext: PreloadChatMessage[] =
          appState.chatMessages.map<PreloadChatMessage>(msg => ({
            role: msg.role,
            content: msg.content,
          }));
        
        lastMessages = [
          { role: 'system', content: SYSTEM_PROMPT } as PreloadChatMessage,
          { role: 'system', content: toolsDoc } as PreloadChatMessage,
          ...(appState.currentFolder
            ? [
                {
                  role: 'system',
                  content: `Carpeta de trabajo actual: ${appState.currentFolder}`,
                } as PreloadChatMessage,
              ]
            : []),
          ...historyMessagesNext,
          { role: 'user', content: userGoal } as PreloadChatMessage,
          { role: 'assistant', content: finalContent } as PreloadChatMessage,
        ];
        iteration += 1;
      }

      console.log(`🔍 DEBUG: Loop completado después de ${iteration} iteraciones`);
      const assistantMessageFinal: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content:
          finalAssistantContent.length > 0
            ? finalAssistantContent
            : 'Lo siento, no puedo ayudarte.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setAppState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, assistantMessageFinal],
        isChatLoading: false,
      }));
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `❌ Error al procesar el mensaje: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        role: 'assistant',
        timestamp: new Date(),
      };

      setAppState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, errorMessage],
        isChatLoading: false,
      }));
    }
  };

  const handleCancelStream = () => {
    try {
      if (abortController) {
        abortController.abort();
        setAbortController(null);
      }
      // Limpiar cualquier operación pendiente en el toolManager
      toolManager.clearPendingOperations();
      
      setAppState(prev => ({ ...prev, isChatLoading: false }));
      const msg: ChatMessage = {
        id: (Date.now() + 3).toString(),
        content: '✅ Operación cancelada por el usuario.',
        role: 'assistant',
        timestamp: new Date(),
      };
      setAppState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, msg],
      }));
    } catch (e) {
      // noop
    }
  };

  return (
    <Layout
      appState={appState}
      onFolderSelect={handleFolderSelect}
      onSendMessage={handleSendMessage}
      onCancelStream={handleCancelStream}
      tokenLimit={tokenLimit}
      onChangeTokenLimit={setTokenLimit}
      onNavigateToFolder={handleNavigateToFolder}
      onNavigateBack={handleNavigateBack}
    />
  );
};

export default App;
