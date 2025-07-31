import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { shareReplay, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PerformanceOptimizationService {
  private cache = new Map<string, any>();
  private loadingStates = new Map<string, BehaviorSubject<boolean>>();
  private dataCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  /**
   * Cache data with TTL (Time To Live)
   */
  setCacheData(key: string, data: any, ttl: number = 300000): void { // 5 minutes default
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.dataCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get cached data if not expired
   */
  getCacheData<T>(key: string): T | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    
    const cached = this.dataCache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.dataCache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const now = Date.now();
    for (const [key, cached] of this.dataCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.dataCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.dataCache.clear();
    this.cache.clear();
  }

  /**
   * Get loading state for a specific key
   */
  getLoadingState(key: string): Observable<boolean> {
    if (!this.loadingStates.has(key)) {
      this.loadingStates.set(key, new BehaviorSubject<boolean>(false));
    }
    return this.loadingStates.get(key)!.asObservable().pipe(shareReplay(1));
  }

  /**
   * Set loading state for a specific key
   */
  setLoadingState(key: string, loading: boolean): void {
    if (!this.loadingStates.has(key)) {
      this.loadingStates.set(key, new BehaviorSubject<boolean>(false));
    }
    this.loadingStates.get(key)!.next(loading);
  }

  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Lazy load images
   */
  lazyLoadImage(imgElement: HTMLImageElement, src: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          imgElement.src = src;
          observer.unobserve(imgElement);
        }
      });
    });
    
    observer.observe(imgElement);
  }

  /**
   * Preload critical resources
   */
  preloadResource(url: string, type: 'image' | 'script' | 'style' = 'image'): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = type;
    document.head.appendChild(link);
  }

  /**
   * Optimize memory usage by clearing unused references
   */
  optimizeMemory(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Clear expired cache
    this.clearExpiredCache();
    
    // Clear loading states that are no longer needed
    for (const [key, subject] of this.loadingStates.entries()) {
      if (subject.value === false) {
        this.loadingStates.delete(key);
      }
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo(): { cacheSize: number; loadingStatesSize: number } {
    return {
      cacheSize: this.dataCache.size,
      loadingStatesSize: this.loadingStates.size
    };
  }

  /**
   * Batch DOM updates for better performance
   */
  batchDOMUpdates(updates: (() => void)[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  /**
   * Optimize scroll performance
   */
  optimizeScroll(element: HTMLElement, callback: (event: Event) => void): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    let ticking = false;
    
    const updateScroll = (event: Event) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          callback(event);
          ticking = false;
        });
        ticking = true;
      }
    };
    
    element.addEventListener('scroll', updateScroll, { passive: true });
  }

  /**
   * Create a virtual scroll helper
   */
  createVirtualScroll<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    buffer: number = 5
  ): { visibleItems: T[]; startIndex: number; endIndex: number } {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const totalHeight = items.length * itemHeight;
    
    return {
      visibleItems: items.slice(0, visibleCount + buffer),
      startIndex: 0,
      endIndex: Math.min(visibleCount + buffer, items.length)
    };
  }

  /**
   * Optimize chart rendering
   */
  optimizeChartRendering(chartElement: HTMLElement, renderCallback: () => void): void {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const observer = new ResizeObserver(() => {
      // Debounce resize events
      this.debounce(() => {
        renderCallback();
      }, 100)();
    });
    
    observer.observe(chartElement);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearAllCache();
    this.loadingStates.clear();
  }
}