import React, { useEffect, useRef, useState, useCallback, useMemo, Suspense } from 'react';
import './Layout.css';
import { logger } from '../../services/loggerService';
import { AppState, ChatMessage } from '../../types/global';

// Lazy loading de componentes para code splitting
const Chat = React.lazy(() => import('../Chat/Chat'));
const FileExplorer = React.lazy(() => import('../FileExplorer/FileExplorer'));

interface LayoutProps {
  appState: AppState;
  onFolderSelect: () => void;
  onSendMessage: (message: string) => void;
  onCancelStream: () => void;
  tokenLimit: number;
  onChangeTokenLimit: (n: number) => void;
  onNavigateToFolder: (folderPath: string) => void;
  onNavigateBack: () => void;
  onRefreshSubfolders?: () => void;
}

const Layout: React.FC<LayoutProps> = ({
  appState,
  onFolderSelect,
  onSendMessage,
  onCancelStream,
  onChangeTokenLimit,
  tokenLimit,
  onNavigateToFolder,
  onNavigateBack,
  onRefreshSubfolders,
}) => {
  logger.debug('Layout component rendering');
  logger.debug('Layout passing to FileExplorer', {
    filesCount: appState.totalFilesCount || 0,
    currentFolder: appState.currentFolder,
    isLoading: appState.isFileLoading,
    filesArray: appState.files
  });

  // Split widths (percentages) controlled via CSS variables
  const [leftPct, setLeftPct] = useState<number>(40); // ~1fr of 1fr/1.5fr
  const [dragging, setDragging] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const onStartDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging || !contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(20, Math.min(80, (x / rect.width) * 100)); // clamp 20%–80%
      setLeftPct(pct);
    };
    const onUp = () => setDragging(false);
    if (dragging) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const toggleTheme = () => {
    const current =
      document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <div className={'layout-container'}>
      <div className={'layout-header'}>
        <span className={'layout-title'}>Desktop Helper</span>
        <button
          className={'header-button'}
          onClick={toggleTheme}
          title="Cambiar tema"
          style={{ marginLeft: 'auto' }}
        >
          🌓 Tema
        </button>
        <button className={'header-button'} title="Ayuda" disabled>
          ℹ️ Ayuda
        </button>
      </div>

      <div
        className={'layout-content'}
        ref={contentRef}
        style={{
          // expose CSS variables for grid columns and divider width
          ['--left-width' as any]: `${leftPct}%`,
          ['--right-width' as any]: `${100 - leftPct}%`,
          ['--divider-width' as any]: '20px',
        }}
      >
        <div className={'chat-panel'}>
          <div className={'layout-chat-header'}>💬 Conversación</div>
          <div className={'chat-content'}>
            <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando chat...</div>}>
              <Chat
                messages={appState.chatMessages}
                onSendMessage={onSendMessage}
                isLoading={appState.isChatLoading}
                onCancel={onCancelStream}
                tokenLimit={tokenLimit}
                onChangeTokenLimit={onChangeTokenLimit}
              />
            </Suspense>
          </div>
        </div>

        {/* Resizer between panels */}
        <div
          className={'resize-handle'}
          onMouseDown={onStartDrag}
          title="Ajustar paneles"
        >
          <div className={'resize-line'} />
          <div className={'resize-icon'}>↔︎</div>
        </div>

        <div className={'file-panel'}>
          <div className={'toolbar'}>
            {appState.currentFolder && (
              <button
                className={'toolbar-button'}
                onClick={onNavigateBack}
                disabled={appState.isFileLoading}
                title="Volver a la carpeta anterior"
              >
                ←
              </button>
            )}
            <button
              className={'toolbar-button toolbar-button-primary'}
              onClick={onFolderSelect}
              disabled={appState.isFileLoading}
            >
              {appState.currentFolder
                ? 'Cambiar Carpeta'
                : 'Seleccionar Carpeta'}
            </button>
            {appState.currentFolder && (
              <span className={'folder-path'}>{appState.currentFolder}</span>
            )}
          </div>
          {/* Breadcrumb */}
          {appState.currentFolder && (
            <div className={'layout-breadcrumb'}>
              <span
                className={'layout-breadcrumb-item'}
                onClick={() =>
                  onNavigateToFolder(
                    appState.currentFolder!.split('/')[0]
                      ? '/' + appState.currentFolder!.split('/')[0]
                      : '/'
                  )
                }
                title="Inicio"
              >
                🏠 Inicio
              </span>
              <span className={'layout-breadcrumb-sep'}>/</span>
              {appState.currentFolder
                .split('/')
                .filter(Boolean)
                .map((segment, idx, arr) => {
                  const path = '/' + arr.slice(0, idx + 1).join('/');
                  return (
                    <React.Fragment key={path}>
                      <span
                        className={'layout-breadcrumb-item'}
                        onClick={() => onNavigateToFolder(path)}
                        title={path}
                      >
                        {segment}
                      </span>
                      {idx < arr.length - 1 && (
                        <span className={'layout-breadcrumb-sep'}>/</span>
                      )}
                    </React.Fragment>
                  );
                })}
            </div>
          )}
          <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Cargando explorador...</div>}>
            <FileExplorer
              files={appState.files}
              currentFolder={appState.currentFolder}
              isLoading={appState.isFileLoading}
              onNavigateToFolder={onNavigateToFolder}
              totalFilesCount={appState.totalFilesCount}
              onRefreshSubfolders={onRefreshSubfolders}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Layout;
