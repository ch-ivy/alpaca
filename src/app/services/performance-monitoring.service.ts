import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  bundleSize: number;
  cacheHitRate: number;
  apiResponseTime: number;
}

export interface PerformanceThresholds {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  apiResponseTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitoringService {
  private metrics$ = new BehaviorSubject<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    bundleSize: 0,
    cacheHitRate: 0,
    apiResponseTime: 0
  });

  private thresholds: PerformanceThresholds = {
    loadTime: 3000, // 3 seconds
    renderTime: 1000, // 1 second
    memoryUsage: 50 * 1024 * 1024, // 50MB
    apiResponseTime: 2000 // 2 seconds
  };

  private cacheHits = 0;
  private cacheMisses = 0;
  private apiCallTimes: number[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeMonitoring();
    }
  }

  /**
   * Initialize performance monitoring
   */
  private initializeMonitoring(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Monitor page load performance
    this.monitorPageLoad();
    
    // Monitor memory usage
    this.monitorMemoryUsage();
    
    // Monitor bundle size
    this.monitorBundleSize();
  }

  /**
   * Monitor page load performance
   */
  private monitorPageLoad(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
        const renderTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
        
        this.updateMetrics({
          loadTime,
          renderTime
        });

        // Log performance warnings
        this.checkPerformanceThresholds();
      }
    });
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize;
      
      this.updateMetrics({
        memoryUsage
      });
    }
  }

  /**
   * Monitor bundle size
   */
  private monitorBundleSize(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const scripts = document.querySelectorAll('script[src]');
    let totalSize = 0;
    
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && src.includes('main') || src.includes('vendor')) {
        // Estimate bundle size (this is a rough estimation)
        totalSize += 100 * 1024; // Assume 100KB per script
      }
    });

    this.updateMetrics({
      bundleSize: totalSize
    });
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(updates: Partial<PerformanceMetrics>): void {
    const currentMetrics = this.metrics$.value;
    const newMetrics = { ...currentMetrics, ...updates };
    
    // Update cache hit rate
    const totalCacheRequests = this.cacheHits + this.cacheMisses;
    if (totalCacheRequests > 0) {
      newMetrics.cacheHitRate = (this.cacheHits / totalCacheRequests) * 100;
    }

    // Update API response time
    if (this.apiCallTimes.length > 0) {
      newMetrics.apiResponseTime = this.apiCallTimes.reduce((a, b) => a + b, 0) / this.apiCallTimes.length;
    }

    this.metrics$.next(newMetrics);
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
    this.updateMetrics({});
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
    this.updateMetrics({});
  }

  /**
   * Record API call time
   */
  recordApiCallTime(time: number): void {
    this.apiCallTimes.push(time);
    
    // Keep only last 100 measurements
    if (this.apiCallTimes.length > 100) {
      this.apiCallTimes.shift();
    }
    
    this.updateMetrics({});
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): Observable<PerformanceMetrics> {
    return this.metrics$.asObservable().pipe(shareReplay(1));
  }

  /**
   * Check performance thresholds and log warnings
   */
  private checkPerformanceThresholds(): void {
    const metrics = this.metrics$.value;
    
    if (metrics.loadTime > this.thresholds.loadTime) {
      console.warn(`Performance Warning: Page load time (${metrics.loadTime}ms) exceeds threshold (${this.thresholds.loadTime}ms)`);
    }
    
    if (metrics.renderTime > this.thresholds.renderTime) {
      console.warn(`Performance Warning: Render time (${metrics.renderTime}ms) exceeds threshold (${this.thresholds.renderTime}ms)`);
    }
    
    if (metrics.memoryUsage > this.thresholds.memoryUsage) {
      console.warn(`Performance Warning: Memory usage (${this.formatBytes(metrics.memoryUsage)}) exceeds threshold (${this.formatBytes(this.thresholds.memoryUsage)})`);
    }
    
    if (metrics.apiResponseTime > this.thresholds.apiResponseTime) {
      console.warn(`Performance Warning: Average API response time (${metrics.apiResponseTime}ms) exceeds threshold (${this.thresholds.apiResponseTime}ms)`);
    }
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    const metrics = this.metrics$.value;
    
    return `
Performance Report:
- Page Load Time: ${metrics.loadTime}ms
- Render Time: ${metrics.renderTime}ms
- Memory Usage: ${this.formatBytes(metrics.memoryUsage)}
- Bundle Size: ${this.formatBytes(metrics.bundleSize)}
- Cache Hit Rate: ${metrics.cacheHitRate.toFixed(2)}%
- Average API Response Time: ${metrics.apiResponseTime}ms
    `.trim();
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Monitor component render time
   */
  monitorComponentRender(componentName: string): () => void {
    if (!isPlatformBrowser(this.platformId)) return () => {};

    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 16) { // 60fps threshold
        console.warn(`Performance Warning: Component ${componentName} took ${renderTime.toFixed(2)}ms to render`);
      }
    };
  }

  /**
   * Monitor function execution time
   */
  monitorFunctionExecution<T>(func: () => T, functionName: string): T {
    if (!isPlatformBrowser(this.platformId)) return func();

    const startTime = performance.now();
    const result = func();
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    if (executionTime > 100) { // 100ms threshold
      console.warn(`Performance Warning: Function ${functionName} took ${executionTime.toFixed(2)}ms to execute`);
    }
    
    return result;
  }

  /**
   * Monitor async function execution time
   */
  async monitorAsyncFunctionExecution<T>(func: () => Promise<T>, functionName: string): Promise<T> {
    if (!isPlatformBrowser(this.platformId)) return func();

    const startTime = performance.now();
    const result = await func();
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    if (executionTime > 1000) { // 1 second threshold
      console.warn(`Performance Warning: Async function ${functionName} took ${executionTime.toFixed(2)}ms to execute`);
    }
    
    return result;
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiCallTimes = [];
    
    this.metrics$.next({
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      bundleSize: 0,
      cacheHitRate: 0,
      apiResponseTime: 0
    });
  }

  /**
   * Export performance data
   */
  exportPerformanceData(): PerformanceMetrics {
    return this.metrics$.value;
  }
}