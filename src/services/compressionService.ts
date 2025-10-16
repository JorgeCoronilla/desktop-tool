/**
 * Compression Service
 * Handles compression and decompression of large data transfers between frontend and backend
 */

export interface CompressionConfig {
  threshold: number; // Minimum size in bytes to trigger compression
  algorithm: 'gzip' | 'deflate';
}

export interface CompressedData {
  compressed: boolean;
  data: string;
  originalSize?: number;
  compressedSize?: number;
}

class CompressionService {
  private config: CompressionConfig = {
    threshold: 1024, // 1KB threshold
    algorithm: 'gzip'
  };

  /**
   * Compress data if it exceeds the threshold
   */
  async compress(data: any): Promise<CompressedData> {
    const jsonString = JSON.stringify(data);
    const originalSize = new Blob([jsonString]).size;

    // Only compress if data exceeds threshold
    if (originalSize < this.config.threshold) {
      return {
        compressed: false,
        data: jsonString,
        originalSize
      };
    }

    try {
      // Use browser's built-in compression
      const stream = new CompressionStream(this.config.algorithm);
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Write data to compression stream
      writer.write(new TextEncoder().encode(jsonString));
      writer.close();

      // Read compressed data
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // Combine chunks and convert to base64
      const compressedArray = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        compressedArray.set(chunk, offset);
        offset += chunk.length;
      }

      const compressedBase64 = btoa(String.fromCharCode(...compressedArray));
      const compressedSize = compressedArray.length;

      console.log(`[CompressionService] Compressed ${originalSize} bytes to ${compressedSize} bytes (${((1 - compressedSize / originalSize) * 100).toFixed(1)}% reduction)`);

      return {
        compressed: true,
        data: compressedBase64,
        originalSize,
        compressedSize
      };
    } catch (error) {
      console.warn('[CompressionService] Compression failed, returning uncompressed data:', error);
      return {
        compressed: false,
        data: jsonString,
        originalSize
      };
    }
  }

  /**
   * Decompress data if it was compressed
   */
  async decompress(compressedData: CompressedData): Promise<any> {
    if (!compressedData.compressed) {
      return JSON.parse(compressedData.data);
    }

    try {
      // Convert base64 back to Uint8Array
      const compressedArray = new Uint8Array(
        atob(compressedData.data)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Use browser's built-in decompression
      const stream = new DecompressionStream(this.config.algorithm);
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();

      // Write compressed data to decompression stream
      writer.write(compressedArray);
      writer.close();

      // Read decompressed data
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      // Combine chunks and convert back to string
      const decompressedArray = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        decompressedArray.set(chunk, offset);
        offset += chunk.length;
      }

      const decompressedString = new TextDecoder().decode(decompressedArray);
      return JSON.parse(decompressedString);
    } catch (error) {
      console.error('[CompressionService] Decompression failed:', error);
      throw new Error('Failed to decompress data');
    }
  }

  /**
   * Update compression configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }
}

export const compressionService = new CompressionService();