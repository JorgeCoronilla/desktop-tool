/**
 * Batch Service for optimizing multiple IPC calls
 * Reduces the number of individual IPC calls by batching them together
 */

import { FileItem } from '../types/global';
import { compressionService, CompressedData } from './compressionService';

interface BatchRequest {
  id: string;
  method: string;
  args: any[];
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface BatchResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

class BatchService {
  private pendingRequests: BatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 10; // 10ms delay to collect requests
  private readonly MAX_BATCH_SIZE = 10;

  async batchCall(method: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      
      this.pendingRequests.push({
        id,
        method,
        args,
        resolve,
        reject
      });

      // If we've reached max batch size, process immediately
      if (this.pendingRequests.length >= this.MAX_BATCH_SIZE) {
        this.processBatch();
        return;
      }

      // Otherwise, set a timeout to process the batch
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, this.BATCH_DELAY);
    });
  }



  private async processBatch() {
    if (this.pendingRequests.length === 0) return;

    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    try {
      // Send batch request to main process
      const responses: BatchResponse[] = await window.electronAPI.batchExecute(
        requests.map(req => ({
          id: req.id,
          method: req.method,
          args: req.args
        }))
      );

      // Resolve individual promises
      responses.forEach(response => {
        const request = requests.find(req => req.id === response.id);
        if (request) {
          if (response.success) {
            request.resolve(response.result);
          } else {
            request.reject(new Error(response.error || 'Unknown error'));
          }
        }
      });
    } catch (error) {
      // If batch fails, reject all requests
      requests.forEach(request => {
        request.reject(error);
      });
    }
  }

  // Optimized method for common file operations
  async getDirectoryInfo(path: string) {
    const [files, totalCount] = await Promise.all([
      this.batchCall('read-directory', path),
      this.batchCall('count-files-recursively', path)
    ]);
    
    return { files, totalCount };
  }

  // Optimized method for file stats
  async getMultipleFileStats(paths: string[]) {
    const promises = paths.map(path => this.batchCall('get-file-stats', path));
    return Promise.all(promises);
  }
}

export const batchService = new BatchService();