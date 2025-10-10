import * as fs from 'fs';
import * as path from 'path';

export interface RenameOptions {
  pattern: string;
  replacement: string;
  useRegex?: boolean;
  includeExtension?: boolean;
  preview?: boolean;
}

export interface RenameResult {
  originalName: string;
  newName: string;
  success: boolean;
  error?: string;
}

export class FileRenamer {
  static async renameFiles(
    directoryPath: string,
    options: RenameOptions
  ): Promise<RenameResult[]> {
    const results: RenameResult[] = [];

    try {
      const files = await fs.promises.readdir(directoryPath);

      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.promises.stat(filePath);

        // Solo procesar archivos, no directorios
        if (!stats.isFile()) continue;

        const result = await this.processFile(filePath, file, options);
        results.push(result);
      }
    } catch (error) {
      throw new Error(`Error reading directory: ${error}`);
    }

    return results;
  }

  private static async processFile(
    filePath: string,
    fileName: string,
    options: RenameOptions
  ): Promise<RenameResult> {
    try {
      const { name: baseName, ext } = path.parse(fileName);
      const targetName = options.includeExtension ? fileName : baseName;

      let newName: string;

      if (options.useRegex) {
        const regex = new RegExp(options.pattern, 'g');
        newName = targetName.replace(regex, options.replacement);
      } else {
        newName = targetName.replace(
          new RegExp(this.escapeRegex(options.pattern), 'g'),
          options.replacement
        );
      }

      // Restaurar extensión si no se incluyó en el renombrado
      if (!options.includeExtension) {
        newName = newName + ext;
      }

      // Si el nombre no cambió, no hacer nada
      if (newName === fileName) {
        return {
          originalName: fileName,
          newName: fileName,
          success: true,
        };
      }

      // Si es solo preview, no renombrar realmente
      if (options.preview) {
        return {
          originalName: fileName,
          newName: newName,
          success: true,
        };
      }

      // Renombrar el archivo
      const newFilePath = path.join(path.dirname(filePath), newName);
      await fs.promises.rename(filePath, newFilePath);

      return {
        originalName: fileName,
        newName: newName,
        success: true,
      };
    } catch (error) {
      return {
        originalName: fileName,
        newName: fileName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Patrones comunes predefinidos
  static getCommonPatterns() {
    return {
      removeSpaces: { pattern: ' ', replacement: '_', useRegex: false },
      removeNumbers: { pattern: '\\d+', replacement: '', useRegex: true },
      addPrefix: { pattern: '^', replacement: 'prefix_', useRegex: true },
      addSuffix: { pattern: '$', replacement: '_suffix', useRegex: true },
      toLowerCase: {
        pattern: '.*',
        replacement: (match: string) => match.toLowerCase(),
        useRegex: true,
      },
      removeSpecialChars: {
        pattern: '[^a-zA-Z0-9._-]',
        replacement: '',
        useRegex: true,
      },
    };
  }
}
