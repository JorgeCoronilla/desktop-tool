"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressionService = void 0;
const loggerService_1 = require("./loggerService");
class CompressionService {
    constructor() {
        this.config = {
            threshold: 1024, // 1KB threshold
            algorithm: 'gzip'
        };
    }
    /**
     * Compress data if it exceeds the threshold
     */
    async compress(data) {
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
            const chunks = [];
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
            loggerService_1.logger.info('Data compressed successfully', {
                originalSize,
                compressedSize,
                reductionPercent: ((1 - compressedSize / originalSize) * 100).toFixed(1)
            });
            return {
                compressed: true,
                data: compressedBase64,
                originalSize,
                compressedSize
            };
        }
        catch (error) {
            loggerService_1.logger.warn('Compression failed, returning uncompressed data', error);
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
    async decompress(compressedData) {
        if (!compressedData.compressed) {
            return JSON.parse(compressedData.data);
        }
        try {
            // Convert base64 back to Uint8Array
            const compressedArray = new Uint8Array(atob(compressedData.data)
                .split('')
                .map(char => char.charCodeAt(0)));
            // Use browser's built-in decompression
            const stream = new DecompressionStream(this.config.algorithm);
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            // Write compressed data to decompression stream
            writer.write(compressedArray);
            writer.close();
            // Read decompressed data
            const chunks = [];
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
        }
        catch (error) {
            loggerService_1.logger.error('Decompression failed', error);
            throw new Error(`Decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Update compression configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
exports.compressionService = new CompressionService();
