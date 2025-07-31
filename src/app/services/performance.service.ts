import { Injectable, NgZone, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, fromEvent } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';

export interface PerformanceMetrics {
  bundleSize: number;
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  chunkLoadTimes: { [key: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceService {
  private metricsSubject = new BehaviorSubject<PerformanceMetrics>({
    bundleSize: 0,
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    chunkLoadTimes: {}
  });

  public metrics$ = this.metricsSubject.asObservable();
  private isBrowser: boolean;

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    if (this.isBrowser) {
      this.initializePerformanceTracking();
    }
  }

  private initializePerformanceTracking(): void {
    // Track initial load performance
    this.ngZone.runOutsideAngular(() => {
      if ('performance' in window) {
        this.trackLoadTime();
        this.trackMemoryUsage();
        this.trackResourceSizes();
        this.setupContinuousMonitoring();
      }
    });
  }

  private trackLoadTime(): void {
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigationTiming) {
      const loadTime = navigationTiming.loadEventEnd - navigationTiming.navigationStart;
      const renderTime = navigationTiming.domContentLoadedEventEnd - navigationTiming.navigationStart;
      
      this.updateMetrics({
        loadTime,
        renderTime
      });
    }
  }

  private trackMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
      
      this.updateMetrics({ memoryUsage });
    }
  }

  private trackResourceSizes(): void {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let totalBundleSize = 0;
    const chunkLoadTimes: { [key: string]: number } = {};

    resources.forEach(resource => {
      if (resource.name.includes('.js') || resource.name.includes('.css')) {
        totalBundleSize += resource.transferSize || 0;
        
        const chunkName = this.extractChunkName(resource.name);
        if (chunkName) {
          chunkLoadTimes[chunkName] = resource.responseEnd - resource.requestStart;
        }
      }
    });

    this.updateMetrics({
      bundleSize: totalBundleSize / (1024 * 1024), // Convert to MB
      chunkLoadTimes
    });
  }

  private extractChunkName(url: string): string {
    const match = url.match(/\/([^\/]+)\.js$/);
    return match ? match[1] : '';
  }

  private setupContinuousMonitoring(): void {
    // Monitor memory usage periodically
    setInterval(() => {
      this.trackMemoryUsage();
    }, 30000); // Every 30 seconds

    // Monitor render performance
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'measure') {
            console.log(`Performance measure: ${entry.name} took ${entry.duration}ms`);
          }
        });
      });

      observer.observe({ entryTypes: ['measure', 'navigation'] });
    }
  }

  private updateMetrics(updates: Partial<PerformanceMetrics>): void {
    const currentMetrics = this.metricsSubject.value;
    this.metricsSubject.next({
      ...currentMetrics,
      ...updates
    });
  }

  // Mark performance measurement points
  markStart(name: string): void {
    if (this.isBrowser && 'performance' in window) {
      performance.mark(`${name}-start`);
    }
  }

  markEnd(name: string): void {
    if (this.isBrowser && 'performance' in window) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }
  }

  // Get core web vitals
  getCoreWebVitals(): Observable<any> {
    return new Observable(observer => {
      if (!this.isBrowser) {
        observer.complete();
        return;
      }

      // First Contentful Paint
      if ('PerformanceObserver' in window) {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcp = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcp) {
            observer.next({ metric: 'FCP', value: fcp.startTime });
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lcp = entries[entries.length - 1];
          observer.next({ metric: 'LCP', value: lcp.startTime });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Cumulative Layout Shift
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          observer.next({ metric: 'CLS', value: clsValue });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      }
    });
  }

  // Lazy loading performance tracker
  trackChunkLoad(chunkName: string): void {
    this.markStart(`chunk-${chunkName}`);
    
    // Mark end when chunk is loaded (should be called after import)
    setTimeout(() => {
      this.markEnd(`chunk-${chunkName}`);
    }, 0);
  }

  // Get performance recommendations
  getPerformanceRecommendations(): string[] {
    const metrics = this.metricsSubject.value;
    const recommendations: string[] = [];

    if (metrics.bundleSize > 2) {
      recommendations.push('Consider code splitting to reduce initial bundle size');
    }

    if (metrics.loadTime > 3000) {
      recommendations.push('Optimize images and enable gzip compression');
    }

    if (metrics.memoryUsage > 50) {
      recommendations.push('Check for memory leaks and optimize data structures');
    }

    return recommendations;
  }
}