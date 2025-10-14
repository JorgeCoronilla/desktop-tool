import React, { useState, useCallback } from 'react';
import './FileExplorer.css';
import { FileItem } from '../../types/global';
// import { MOCK_TREE } from './mockData'; // Comentado: retiramos mock del árbol

interface FileExplorerProps {
  files: FileItem[];
  currentFolder: string | null;
  isLoading: boolean;
  onNavigateToFolder: (folderPath: string) => void;
  totalFilesCount?: number;
  onRefreshSubfolders?: () => void;
}

interface TreeNode extends FileItem {
  children?: TreeNode[];
  isExpanded?: boolean;
  level?: number;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ files, currentFolder, isLoading, onNavigateToFolder, totalFilesCount, onRefreshSubfolders }) => {
  console.log('[FileExplorer] Component rendering with:', {
    filesCount: totalFilesCount || 0,
    currentFolder,
    isLoading,
    filesArray: files
  });
  console.log('[FileExplorer] Files names:', files.map(f => f.name));

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Map<string, FileItem[]>>(
    new Map()
  );

  // Usamos clases globales desde styles/fallback.css
  const currentStyles = {
    container: 'file-explorer-container',
    fileList: 'file-list',
    fileItem: 'file-item',
    fileIcon: 'file-icon',
    folderIcon: 'folder-icon',
    fileIconDefault: 'file-icon-default',
    fileIconImage: 'file-icon-image',
    fileIconDocument: 'file-icon-document',
    fileIconCode: 'file-icon-code',
    fileIconArchive: 'file-icon-archive',
    fileName: 'file-name',
    fileSize: 'file-size',
    emptyState: 'empty-state',
    loadingState: 'loading-state',
    treeItem: 'tree-item',
    treeIndent: 'tree-indent',
    expandButton: 'expand-button',
    expandIcon: 'expand-icon',
  } as const;

  // Función para cargar contenido de una carpeta
  const loadFolderContents = useCallback(async (folderPath: string) => {
    try {
      let contents: FileItem[] = [];
      if (
        (window as any).electronAPI &&
        typeof window.electronAPI.readDirectory === 'function'
      ) {
        contents = await window.electronAPI.readDirectory(folderPath);
      } else {
        // contents = MOCK_TREE[folderPath] || []; // Comentado: sin mock en modo web
        contents = [];
      }
      setFolderContents(prev => new Map(prev).set(folderPath, contents));
      return contents;
    } catch (error) {
      console.error('Error loading folder contents:', error);
      return [];
    }
  }, []);

  // Función para refrescar todas las carpetas expandidas
  const refreshExpandedFolders = useCallback(async () => {
    console.log('[FileExplorer] Refreshing expanded folders:', Array.from(expandedFolders));
    
    // Recargar contenido de todas las carpetas expandidas
    for (const folderPath of expandedFolders) {
      try {
        await loadFolderContents(folderPath);
        console.log('[FileExplorer] Refreshed folder:', folderPath);
      } catch (error) {
        console.error('[FileExplorer] Error refreshing folder:', folderPath, error);
      }
    }
  }, [expandedFolders, loadFolderContents]);

  // Exponer la función de refresh a través del callback
  React.useEffect(() => {
    if (onRefreshSubfolders) {
      // Reemplazar la función de callback con nuestra función local
      (window as any).__refreshExpandedFolders = refreshExpandedFolders;
    }
  }, [refreshExpandedFolders, onRefreshSubfolders]);

  // Función para alternar expansión de carpetas
  const toggleFolder = useCallback(
    async (folderPath: string) => {
      const newExpanded = new Set(expandedFolders);

      if (expandedFolders.has(folderPath)) {
        newExpanded.delete(folderPath);
      } else {
        newExpanded.add(folderPath);
        // Cargar contenido si no está cargado
        if (!folderContents.has(folderPath)) {
          await loadFolderContents(folderPath);
        }
      }

      setExpandedFolders(newExpanded);
    },
    [expandedFolders, folderContents, loadFolderContents]
  );

  const getFileIcon = (
    fileName: string,
    isDirectory: boolean,
    isExpanded: boolean = false
  ) => {
    if (isDirectory) {
      return (
        <span
          className={`${currentStyles.fileIcon} ${currentStyles.folderIcon}`}
        >
          {isExpanded ? '📂' : '📁'}
        </span>
      );
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    let icon = '📄';

    if (
      ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(
        extension || ''
      )
    ) {
      icon = '🖼️';
    } else if (['pdf'].includes(extension || '')) {
      icon = '📕';
    } else if (['doc', 'docx'].includes(extension || '')) {
      icon = '📘';
    } else if (['txt', 'md', 'readme'].includes(extension || '')) {
      icon = '📝';
    } else if (['js', 'jsx'].includes(extension || '')) {
      icon = '🟨';
    } else if (['ts', 'tsx'].includes(extension || '')) {
      icon = '🔷';
    } else if (['py'].includes(extension || '')) {
      icon = '🐍';
    } else if (['java'].includes(extension || '')) {
      icon = '☕';
    } else if (['cpp', 'c', 'h'].includes(extension || '')) {
      icon = '⚙️';
    } else if (['html', 'htm'].includes(extension || '')) {
      icon = '🌐';
    } else if (['css', 'scss', 'sass'].includes(extension || '')) {
      icon = '🎨';
    } else if (['json', 'xml', 'yaml', 'yml'].includes(extension || '')) {
      icon = '📋';
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '')) {
      icon = '📦';
    } else if (['mp3', 'wav', 'flac', 'aac'].includes(extension || '')) {
      icon = '🎵';
    } else if (['mp4', 'avi', 'mkv', 'mov'].includes(extension || '')) {
      icon = '🎬';
    }

    return (
      <span
        className={`${currentStyles.fileIcon} ${currentStyles.fileIconDefault}`}
      >
        {icon}
      </span>
    );
  };

  const formatFileSize = (size?: number) => {
    if (!size) return '';

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024)
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleFileClick = (file: FileItem) => {
    if (file.isDirectory) {
      toggleFolder(file.path);
    } else {
      // TODO: Implementar previsualización de archivos
      console.log('File clicked:', file);
    }
  };

  const handleFileDoubleClick = (file: FileItem) => {
    if (file.isDirectory) {
      onNavigateToFolder(file.path);
    } else {
      // TODO: Implementar apertura de archivos
      console.log('File double-clicked:', file);
    }
  };

  // Función para renderizar un elemento del árbol
  const renderTreeItem = (file: FileItem, level: number = 0) => {
    const isExpanded = expandedFolders.has(file.path);
    const children = file.isDirectory
      ? folderContents.get(file.path) || []
      : [];

    return (
      <div key={file.path}>
        <div
          className={currentStyles.treeItem}
          style={{ paddingLeft: `${level * 20}px` }}
        >
          {file.isDirectory && (
            <button
              className={currentStyles.expandButton}
              onClick={() => toggleFolder(file.path)}
              aria-label={isExpanded ? 'Colapsar carpeta' : 'Expandir carpeta'}
            >
              <span
                className={currentStyles.expandIcon}
                style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  display: 'inline-block',
                }}
              >
                ▶
              </span>
            </button>
          )}
          <button
            className={currentStyles.fileItem}
            onClick={() => handleFileClick(file)}
            onDoubleClick={() => handleFileDoubleClick(file)}
            title={file.path}
            style={{ flex: 1, marginLeft: file.isDirectory ? '0' : '20px' }}
          >
            {getFileIcon(file.name, file.isDirectory, isExpanded)}
            <span className={currentStyles.fileName}>{file.name}</span>
            {!file.isDirectory && file.size && (
              <span className={currentStyles.fileSize}>
                {formatFileSize(file.size)}
              </span>
            )}
          </button>
        </div>

        {file.isDirectory && isExpanded && children.length > 0 && (
          <div>
            {children
              .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
              })
              .map(child => renderTreeItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={currentStyles.container}>
        <div className={currentStyles.loadingState}>Cargando archivos...</div>
      </div>
    );
  }

  if (!currentFolder) {
    return (
      <div className={currentStyles.container}>
        <div className={currentStyles.emptyState}>
          <div>📁</div>
          <div>Selecciona una carpeta para comenzar</div>
          <div style={{ fontSize: '11px', marginTop: '8px' }}>
            Usa el botón "Seleccionar Carpeta" para elegir un directorio
          </div>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={currentStyles.container}>
        <div className={currentStyles.emptyState}>
          <div>📂</div>
          <div>La carpeta está vacía</div>
        </div>
      </div>
    );
  }

  // Ordenar archivos: carpetas primero, luego archivos alfabéticamente
  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={currentStyles.container}>
      <div className={currentStyles.fileList}>
        {sortedFiles.map(file => renderTreeItem(file, 0))}
      </div>
    </div>
  );
};

export default FileExplorer;
