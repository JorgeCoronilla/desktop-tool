/**
 * Connection Pool Service
 * Manages connection pooling for external services to optimize resource usage
 */

import { logger } from './loggerService';

export interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number; // milliseconds
  idleTimeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface Connection {
  id: string;
  service: string;
  created: number;
  lastUsed: number;
  inUse: boolean;
  client?: any;
}

export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  pending: number;
}

class ConnectionPoolService {
  private pools: Map<string, Connection[]> = new Map();
  private pendingRequests: Map<string, Array<{ resolve: Function; reject: Function }>> = new Map();
  private configs: Map<string, PoolConfig> = new Map();
  private cleanupIntervals: Map<string, NodeJS.Timeout> = new Map();

  private defaultConfig: PoolConfig = {
    maxConnections: 5,
    minConnections: 1,
    connectionTimeout: 30000, // 30 seconds
    idleTimeout: 300000, // 5 minutes
    retryAttempts: 3,
    retryDelay: 1000 // 1 second
  };

  /**
   * Initialize a connection pool for a service
   */
  initializePool(serviceName: string, config?: Partial<PoolConfig>): void {
    const poolConfig = { ...this.defaultConfig, ...config };
    this.configs.set(serviceName, poolConfig);
    this.pools.set(serviceName, []);
    this.pendingRequests.set(serviceName, []);

    // Start cleanup interval
    const cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections(serviceName);
    }, 60000); // Check every minute

    this.cleanupIntervals.set(serviceName, cleanupInterval);

    logger.info(`Initialized pool for ${serviceName}`, { serviceName, poolConfig });
  }

  /**
   * Get a connection from the pool
   */
  async getConnection(serviceName: string): Promise<Connection> {
    if (!this.pools.has(serviceName)) {
      throw new Error(`Pool not initialized for service: ${serviceName}`);
    }

    const pool = this.pools.get(serviceName)!;
    const config = this.configs.get(serviceName)!;

    // Try to find an available connection
    const availableConnection = pool.find(conn => !conn.inUse);
    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();
      logger.debug(`Reusing connection ${availableConnection.id} for ${serviceName}`, { connectionId: availableConnection.id, serviceName });
      return availableConnection;
    }

    // Create new connection if under limit
    if (pool.length < config.maxConnections) {
      const newConnection = await this.createConnection(serviceName);
      pool.push(newConnection);
      logger.info(`Created new connection ${newConnection.id} for ${serviceName}`, { connectionId: newConnection.id, serviceName });
      return newConnection;
    }

    // Wait for an available connection
    logger.warn(`Pool full for ${serviceName}, waiting for available connection`, { serviceName, poolSize: pool.length, maxConnections: config.maxConnections });
    return new Promise((resolve, reject) => {
      const pending = this.pendingRequests.get(serviceName)!;
      pending.push({ resolve, reject });

      // Set timeout for pending request
      setTimeout(() => {
        const index = pending.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          pending.splice(index, 1);
          reject(new Error(`Connection timeout for service: ${serviceName}`));
        }
      }, config.connectionTimeout);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(serviceName: string, connectionId: string): void {
    const pool = this.pools.get(serviceName);
    if (!pool) return;

    const connection = pool.find(conn => conn.id === connectionId);
    if (!connection) return;

    connection.inUse = false;
    connection.lastUsed = Date.now();

    // Check if there are pending requests
    const pending = this.pendingRequests.get(serviceName)!;
    if (pending.length > 0) {
      const { resolve } = pending.shift()!;
      connection.inUse = true;
      resolve(connection);
    }

    logger.debug(`Released connection ${connectionId} for ${serviceName}`, { connectionId, serviceName });
  }

  /**
   * Create a new connection for a service
   */
  private async createConnection(serviceName: string): Promise<Connection> {
    const connection: Connection = {
      id: `${serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      service: serviceName,
      created: Date.now(),
      lastUsed: Date.now(),
      inUse: true
    };

    // Service-specific connection logic
    switch (serviceName) {
      case 'openai':
        // OpenAI connections are stateless, so we don't need to create actual connections
        // This is more about rate limiting and request management
        break;
      case 'mcp':
        // MCP connections might need actual connection setup
        // This would be implemented based on MCP service requirements
        break;
      default:
        logger.warn(`Unknown service: ${serviceName}`, { serviceName });
    }

    return connection;
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(serviceName: string): void {
    const pool = this.pools.get(serviceName);
    const config = this.configs.get(serviceName);
    if (!pool || !config) return;

    const now = Date.now();
    const idleConnections = pool.filter(
      conn => !conn.inUse && (now - conn.lastUsed) > config.idleTimeout
    );

    // Keep minimum connections
    const connectionsToRemove = Math.max(0, pool.length - config.minConnections);
    const toRemove = idleConnections.slice(0, connectionsToRemove);

    for (const connection of toRemove) {
      const index = pool.indexOf(connection);
      if (index !== -1) {
        pool.splice(index, 1);
        logger.debug(`Removed idle connection ${connection.id} for ${serviceName}`, { connectionId: connection.id, serviceName });
      }
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats(serviceName: string): PoolStats | null {
    const pool = this.pools.get(serviceName);
    const pending = this.pendingRequests.get(serviceName);
    if (!pool || !pending) return null;

    return {
      total: pool.length,
      active: pool.filter(conn => conn.inUse).length,
      idle: pool.filter(conn => !conn.inUse).length,
      pending: pending.length
    };
  }

  /**
   * Get all pool statistics
   */
  getAllPoolStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {};
    for (const serviceName of this.pools.keys()) {
      const poolStats = this.getPoolStats(serviceName);
      if (poolStats) {
        stats[serviceName] = poolStats;
      }
    }
    return stats;
  }

  /**
   * Destroy a pool and clean up resources
   */
  destroyPool(serviceName: string): void {
    const pool = this.pools.get(serviceName);
    const pending = this.pendingRequests.get(serviceName);
    const interval = this.cleanupIntervals.get(serviceName);

    if (pool) {
      // Close all connections
      for (const connection of pool) {
        // Service-specific cleanup would go here
      }
      this.pools.delete(serviceName);
    }

    if (pending) {
      // Reject all pending requests
      for (const { reject } of pending) {
        reject(new Error(`Pool destroyed for service: ${serviceName}`));
      }
      this.pendingRequests.delete(serviceName);
    }

    if (interval) {
      clearInterval(interval);
      this.cleanupIntervals.delete(serviceName);
    }

    this.configs.delete(serviceName);
    logger.info(`Destroyed pool for ${serviceName}`, { serviceName });
  }

  /**
   * Destroy all pools
   */
  destroyAllPools(): void {
    for (const serviceName of this.pools.keys()) {
      this.destroyPool(serviceName);
    }
  }
}

export const connectionPoolService = new ConnectionPoolService();