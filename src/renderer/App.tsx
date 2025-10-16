import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import {
  AppState,
  FileItem,
  ChatMessage,
  // PreloadChatMessage,
  // OpenAIResponse,
  OpenAIConfig,
  TaskState,
} from '../types/global';
import { SecureMCPServiceWrapper, MCPServiceWrapper } from '../services/mcpServiceWrapper';
import { MCPMessage, MCPStreamChunk } from '../services/mcpService';
import { batchService } from '../services/batchService';
import { connectionPoolService } from '../services/connectionPoolService';

const SYSTEM_PROMPT = `Eres un asistente amigable para gestión de archivos y documentos. Ayudas al usuario con tareas de gestión de archivos, lectura de documentos PDF, manipulación de Excel y más.

Tienes acceso a herramientas MCP que se ejecutan automáticamente cuando las necesites. Simplemente describe lo que quieres hacer y las herramientas se ejecutarán automáticamente.

REGLAS IMPORTANTES:
- Sé amigable y útil en tus respuestas
- Usa rutas absolutas cuando sea posible
- Explica lo que estás haciendo
- Las herramientas se ejecutan automáticamente, no necesitas formato JSON especial

EJEMPLO:
Usuario: "Crea un archivo llamado notas.txt con el contenido 'Hola mundo'"
Asistente: Voy a crear el archivo notas.txt para ti con el contenido que solicitas.`;

const App: React.FC = () => {
  console.log('App component rendering...');
  console.log('window.electronAPI:', window.electronAPI);

  // Instancia del MCPService real
  const [mcpService, setMcpService] = useState<MCPServiceWrapper | null>(null);

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
    totalFilesCount: 0,
  });

  const [openaiConfig, setOpenaiConfig] = useState<OpenAIConfig | null>(null);
  const [isOpenAIInitialized, setIsOpenAIInitialized] = useState(false);
  const [tokenLimit, setTokenLimit] = useState<number>(4000);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    toolName: string;
    args: Record<string, any>;
    message: string;
    originalMessages: any[];
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  // Helper: refrescar el árbol si alguna herramienta modifica el sistema de archivos


  // Verificar configuración de OpenAI al cargar
  useEffect(() => {
    const checkOpenAIConfig = async () => {
      // Initialize connection pools for external services
      try {
        console.log('[App] Initializing connection pools...');
        connectionPoolService.initializePool('openai', {
          maxConnections: 3,
          minConnections: 1,
          connectionTimeout: 30000,
          idleTimeout: 300000
        });
        connectionPoolService.initializePool('mcp', {
          maxConnections: 2,
          minConnections: 1,
          connectionTimeout: 15000,
          idleTimeout: 180000
        });
        console.log('[App] Connection pools initialized successfully');
      } catch (error) {
        console.error('[App] Error initializing connection pools:', error);
      }

      // Inicializar MCPService
      try {
        console.log('[App] Creating SecureMCPServiceWrapper...');
        // Usar el wrapper seguro que no expone la API key
        const service = new SecureMCPServiceWrapper();
        console.log('[App] SecureMCPServiceWrapper created, checking initialization...');
        
        const isInitialized = await service.isInitialized();
        console.log('[App] mcpService initialization status:', isInitialized);
        
        if (isInitialized) {
          setMcpService(service);
          console.log('[App] mcpService set successfully');
        } else {
          console.warn('[App] mcpService failed to initialize');
        }
      } catch (error) {
        console.error('[App] Error initializing mcpService:', error);
      }

      // Si estamos en preview del navegador, window.electronAPI no existe
      if (!(window as any).electronAPI) {
        console.warn('electronAPI no disponible: ejecutando en modo web');
        const model = process.env.OPENAI_MODEL || 'gpt-4o';
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

  // File watcher effect
  useEffect(() => {
    if (!(window as any).electronAPI || !appState.currentFolder) {
      return;
    }

    const startWatcher = async () => {
      try {
        console.log('[DEBUG] Starting file watcher for:', appState.currentFolder);
        await window.electronAPI.startFileWatcher(appState.currentFolder);
        console.log('[DEBUG] File watcher started successfully');
      } catch (error) {
        console.error('[DEBUG] Error starting file watcher:', error);
      }
    };

    // Listen for file system changes
    const handleFileSystemChange = (event: any, changeData: any) => {
      console.log('[DEBUG] File system change detected:', changeData);
      // Refresh the current folder when changes are detected
      refreshCurrentFolderIfChanged();
    };

    // Add event listener for file system changes
    if ((window as any).electronAPI && typeof (window as any).electronAPI.on === 'function') {
      (window as any).electronAPI.on('file-system-change', handleFileSystemChange);
    } else {
      // Fallback: use ipcRenderer directly if available
      const { ipcRenderer } = window.require('electron');
      if (ipcRenderer) {
        ipcRenderer.on('file-system-change', handleFileSystemChange);
      }
    }

    startWatcher();

    // Cleanup function
    return () => {
      const cleanup = async () => {
        try {
          console.log('[DEBUG] Stopping file watcher');
          await window.electronAPI.stopFileWatcher();
          console.log('[DEBUG] File watcher stopped');
        } catch (error) {
          console.error('[DEBUG] Error stopping file watcher:', error);
        }
      };

      // Remove event listener
      if ((window as any).electronAPI && typeof (window as any).electronAPI.off === 'function') {
        (window as any).electronAPI.off('file-system-change', handleFileSystemChange);
      } else {
        // Fallback: use ipcRenderer directly if available
        try {
          const { ipcRenderer } = window.require('electron');
          if (ipcRenderer) {
            ipcRenderer.removeListener('file-system-change', handleFileSystemChange);
          }
        } catch (e) {
          console.warn('[DEBUG] Could not remove ipcRenderer listener:', e);
        }
      }

      cleanup();
    };
  }, [appState.currentFolder]);

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
        // Use batching service to optimize multiple IPC calls
        const { files, totalCount } = await batchService.getDirectoryInfo(folderPath);
        setAppState(prev => ({
          ...prev,
          currentFolder: folderPath,
          files,
          totalFilesCount: totalCount,
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
      // Use batching service to optimize multiple IPC calls
      const { files, totalCount } = await batchService.getDirectoryInfo(folderPath);
      setAppState(prev => ({
        ...prev,
        currentFolder: folderPath,
        files,
        totalFilesCount: totalCount,
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
    console.log('[App] handleSendMessage called with content:', content);
    console.log('[App] mcpService status:', !!mcpService);
    
    if (!mcpService) {
      console.warn('[App] mcpService is not initialized');
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: '❌ MCPService no está inicializado. Por favor, recarga la aplicación.',
        role: 'assistant',
        timestamp: new Date(),
      };
      setAppState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, errorMessage],
      }));
      return;
    }

    // Verificar si se requiere una carpeta seleccionada usando análisis inteligente
    const checkIfRequiresFolder = async (userMessage: string): Promise<boolean> => {
      // Si ya hay una carpeta seleccionada, no necesitamos validar
      if (appState.currentFolder) return false;
      
      try {
        // Usar OpenAI para determinar si la solicitud requiere operaciones con archivos
        const analysisPrompt = `Analiza el siguiente mensaje del usuario y determina si requiere operaciones con archivos o carpetas (crear, leer, escribir, modificar, eliminar, buscar archivos, etc.).

Mensaje del usuario: "${userMessage}"

Responde SOLO con "SI" si requiere operaciones con archivos/carpetas, o "NO" si es una pregunta general, conversación o no requiere acceso al sistema de archivos.

Ejemplos:
- "Crea un archivo de texto" → SI
- "Lee el PDF que está en la carpeta" → SI  
- "¿Cómo estás?" → NO
- "Explícame qué es Python" → NO
- "Busca archivos Excel" → SI
- "Hola" → NO

Respuesta:`;

        const response = await window.electronAPI.sendMessageToOpenAI([
           { id: Date.now().toString(), role: 'user', content: analysisPrompt, timestamp: new Date() }
         ]);

         if (!response.success || !response.response) {
           throw new Error('OpenAI response failed');
         }

         const result = response.response.trim().toUpperCase();
         return result === 'SI' || result === 'YES' || result === 'SÍ';
      } catch (error) {
        console.error('[App] Error analyzing message for folder requirement:', error);
        // En caso de error, usar una validación básica como fallback
        const basicKeywords = ['file', 'archivo', 'crear', 'create', 'read', 'leer', 'write', 'escribir'];
        return basicKeywords.some(keyword => 
          userMessage.toLowerCase().includes(keyword)
        );
      }
    };

    const requiresFolder = await checkIfRequiresFolder(content);

    if (requiresFolder && !appState.currentFolder) {
      console.log('[App] File operation requested but no folder selected');
      
      // Agregar el mensaje del usuario primero
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        content,
        role: 'user',
        timestamp: new Date(),
      };
      
      const warningMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: '📁 Para realizar operaciones con archivos, primero debes seleccionar una carpeta de trabajo. Por favor, haz clic en "Seleccionar Carpeta" en el explorador de archivos.',
        role: 'assistant',
        timestamp: new Date(),
      };
      
      setAppState(prev => ({
        ...prev,
        chatMessages: [...prev.chatMessages, userMessage, warningMessage],
      }));
      return;
    }

    console.log('[App] Creating new user message');
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    console.log('[App] Updating app state with new message and loading state');
    setAppState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, newMessage],
      isChatLoading: true,
    }));

    try {
        // Convertir mensajes al formato MCPMessage
        const mcpMessages = [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...(appState.currentFolder
            ? [{ role: 'system' as const, content: `Carpeta de trabajo actual: ${appState.currentFolder}` }]
            : []),
          ...appState.chatMessages.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          { role: 'user' as const, content },
        ];

      // Crear mensaje del asistente vacío para streaming
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

      // Usar MCPService
      const response = await mcpService.sendMessage(mcpMessages, {
        currentFolder: appState.currentFolder || undefined,
      });

      // Verificar si se necesita confirmación
      console.log('[DEBUG] Checking for confirmation need:', !!response.needsConfirmation);
      if (response.needsConfirmation) {
        console.log('[DEBUG] Confirmation needed for:', response.needsConfirmation.toolName);
        console.log('[DEBUG] Confirmation message:', response.needsConfirmation.message);
        
        // Mostrar modal de confirmación
        const confirmed = await new Promise<boolean>((resolve) => {
          setPendingConfirmation({
            toolName: response.needsConfirmation.toolName,
            args: response.needsConfirmation.args,
            message: response.needsConfirmation.message,
            originalMessages: mcpMessages,
            resolve
          });
        });

        // Limpiar el estado de confirmación
        setPendingConfirmation(null);

        if (confirmed) {
          // Si se confirma, reenviar el mensaje con confirmación
          const confirmedResponse = await mcpService.sendMessage([
            ...mcpMessages,
            { role: 'user' as const, content: `CONFIRMADO: Proceder con ${response.needsConfirmation.toolName}` }
          ], {
            currentFolder: appState.currentFolder || undefined,
          });

          // Actualizar con la respuesta confirmada
          setAppState(prev => {
            const msgs = [...prev.chatMessages];
            const idx = msgs.findIndex(m => m.id === assistantId);
            if (idx >= 0) {
              msgs[idx] = { ...msgs[idx], content: confirmedResponse.content };
            }
            return { ...prev, chatMessages: msgs };
          });

          // Refrescar la carpeta si se ejecutaron herramientas
          console.log('[DEBUG] Confirmed response:', {
            hasContent: !!confirmedResponse.content,
            hasToolCalls: !!confirmedResponse.toolCalls,
            toolCallsLength: confirmedResponse.toolCalls?.length || 0,
            toolCalls: confirmedResponse.toolCalls?.map(tc => tc.name) || []
          });
          
          if (confirmedResponse.toolCalls && confirmedResponse.toolCalls.length > 0) {
            console.log('[DEBUG] Tool calls detected in confirmed response, applying 500ms delay...');
            // Agregar un pequeño delay para permitir que las operaciones de archivo se completen
            setTimeout(async () => {
              console.log('[DEBUG] Refreshing folder after 500ms delay...');
              await refreshCurrentFolderIfChanged();
            }, 500);
          } else {
            console.log('[DEBUG] No tool calls in confirmed response, applying 500ms delay anyway...');
            setTimeout(async () => {
              console.log('[DEBUG] Refreshing folder after 500ms delay (no tool calls)...');
              await refreshCurrentFolderIfChanged();
            }, 500);
          }
        } else {
          // Si se cancela, mostrar mensaje de cancelación
          setAppState(prev => {
            const msgs = [...prev.chatMessages];
            const idx = msgs.findIndex(m => m.id === assistantId);
            if (idx >= 0) {
              msgs[idx] = { ...msgs[idx], content: response.content };
            }
            return { ...prev, chatMessages: msgs };
          });
        }
      } else {
        // Actualizar con la respuesta final
        setAppState(prev => {
          const msgs = [...prev.chatMessages];
          const idx = msgs.findIndex(m => m.id === assistantId);
          if (idx >= 0) {
            msgs[idx] = { ...msgs[idx], content: response.content };
          }
          return { ...prev, chatMessages: msgs };
        });

        // Refrescar la carpeta si se ejecutaron herramientas que modifican archivos
        console.log('[DEBUG] Response from MCP:', {
          hasContent: !!response.content,
          hasToolCalls: !!response.toolCalls,
          toolCallsLength: response.toolCalls?.length || 0,
          hasNeedsConfirmation: !!response.needsConfirmation,
          toolCalls: response.toolCalls || 'none'
        });
        
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log('[DEBUG] Tool calls detected:', response.toolCalls.map(tc => tc.name));
          console.log('[DEBUG] Applying 500ms delay before refreshing folder...');
          // Agregar un pequeño delay para permitir que las operaciones de archivo se completen
          setTimeout(async () => {
            console.log('[DEBUG] Refreshing folder after 500ms delay (general response)...');
            await refreshCurrentFolderIfChanged();
          }, 500);
        } else {
          console.log('[DEBUG] No tool calls detected, applying 500ms delay anyway for testing...');
          setTimeout(async () => {
            console.log('[DEBUG] Refreshing folder after 500ms delay (no tool calls - general)...');
            await refreshCurrentFolderIfChanged();
          }, 500);
        }
      }

      setAppState(prev => ({ ...prev, isChatLoading: false }));
    } catch (error) {
      console.error('Error en handleSendMessage:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
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

  // Helper: refrescar el árbol si se ejecutaron herramientas que modifican archivos
  const refreshCurrentFolderIfChanged = async () => {
    try {
      console.log('[DEBUG] refreshCurrentFolderIfChanged called');
      console.log('[DEBUG] electronAPI available:', !!(window as any).electronAPI);
      console.log('[DEBUG] currentFolder:', appState.currentFolder);
      
      if (!(window as any).electronAPI) {
        console.log('[DEBUG] No electronAPI available, skipping refresh');
        return; // Solo aplica en Electron
      }
      if (!appState.currentFolder) {
        console.log('[DEBUG] No currentFolder set, skipping refresh');
        return;
      }
      
      console.log('[DEBUG] Reading directory:', appState.currentFolder);
      
      // Use batching service to optimize multiple IPC calls
      let files: FileItem[] = [];
      let totalFilesCount = 0;
      try {
        const { files: batchedFiles, totalCount } = await batchService.getDirectoryInfo(appState.currentFolder);
        files = batchedFiles;
        totalFilesCount = totalCount;
        console.log('[DEBUG] Directory read successful, files count:', files.length);
        console.log('[DEBUG] Files found:', files.map(f => f.name));
        console.log('[DEBUG] Total files recursively:', totalFilesCount);
      } catch (batchError) {
        console.error('[DEBUG] Error with batched calls, falling back to individual calls:', batchError);
        // Fallback to individual calls if batching fails
        try {
          files = await window.electronAPI.readDirectory(appState.currentFolder);
          totalFilesCount = await window.electronAPI.countFilesRecursively(appState.currentFolder);
        } catch (fallbackError) {
          console.error('[DEBUG] Error with fallback calls:', fallbackError);
          totalFilesCount = files.length;
        }
      }
      
      // Forzar nueva referencia del array para que React detecte el cambio
      const newFiles = [...files];
      setAppState(prev => ({ 
        ...prev, 
        files: newFiles,
        totalFilesCount: totalFilesCount,
        // También forzar actualización con timestamp para garantizar re-render
        lastUpdate: Date.now()
      }));
      console.log('[DEBUG] App state updated with new files and total count (forced new reference)');
      
      // También refrescar las subcarpetas expandidas
      console.log('[DEBUG] Refreshing expanded subfolders...');
      handleRefreshSubfolders();
    } catch (e) {
      console.error('[DEBUG] Error in refreshCurrentFolderIfChanged:', e);
    }
  };

  const handleCancelStream = () => {
    setAppState(prev => ({ ...prev, isChatLoading: false }));
  };

  const handleConfirmOperation = () => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(true);
    }
  };

  const handleCancelOperation = () => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(false);
    }
  };

  const handleRefreshSubfolders = () => {
    console.log('[DEBUG] handleRefreshSubfolders called');
    // Llamar a la función expuesta por FileExplorer
    if ((window as any).__refreshExpandedFolders) {
      console.log('[DEBUG] Calling __refreshExpandedFolders');
      (window as any).__refreshExpandedFolders();
    } else {
      console.log('[DEBUG] __refreshExpandedFolders not available');
    }
  };

  return (
    <>
      <Layout
        appState={appState}
        onFolderSelect={handleFolderSelect}
        onSendMessage={handleSendMessage}
        onCancelStream={handleCancelStream}
        tokenLimit={tokenLimit}
        onChangeTokenLimit={setTokenLimit}
        onNavigateToFolder={handleNavigateToFolder}
        onNavigateBack={handleNavigateBack}
        onRefreshSubfolders={handleRefreshSubfolders}
      />
      
      {/* Modal de confirmación */}
      {pendingConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>
              Confirmación requerida
            </h3>
            <p style={{ margin: '0 0 24px 0', color: '#666', lineHeight: '1.5' }}>
              {pendingConfirmation.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelOperation}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#666',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmOperation}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
