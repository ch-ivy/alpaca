import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Observable, Subject, BehaviorSubject, combineLatest, distinctUntilChanged, shareReplay, takeUntil, debounceTime, map } from 'rxjs';

// Performance Memoization Decorator
export function Memoize(expirationTime?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map();

    descriptor.value = function (...args: any[]) {
      const key = JSON.stringify(args);
      
      if (cache.has(key)) {
        const cached = cache.get(key);
        if (!expirationTime || Date.now() - cached.timestamp < expirationTime) {
          return cached.value;
        }
      }

      const result = originalMethod.apply(this, args);
      cache.set(key, {
        value: result,
        timestamp: Date.now()
      });

      return result;
    };

    return descriptor;
  };
}

// Subscription Management Mixin
export class SubscriptionMixin implements OnDestroy {
  private destroy$ = new Subject<void>();

  protected takeUntilDestroy<T>() {
    return takeUntil<T>(this.destroy$);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Pure pipe for complex calculations
@Pipe({ name: 'memoizedCalculation', pure: true })
export class MemoizedCalculationPipe implements PipeTransform {
  private cache = new Map<string, any>();

  transform(value: any, calculationFn: Function, ...args: any[]): any {
    const key = JSON.stringify({ value, args });
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const result = calculationFn(value, ...args);
    this.cache.set(key, result);
    
    return result;
  }
}

// Virtual Scrolling Helper
export class VirtualScrollHelper {
  static calculateVisibleItems(
    containerHeight: number,
    itemHeight: number,
    scrollTop: number,
    buffer: number = 5
  ) {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + (buffer * 2);
    
    return {
      startIndex,
      endIndex: startIndex + visibleCount,
      visibleCount
    };
  }
}

// Observable Performance Helper
export class ObservablePerformanceHelper {
  static createMemoizedCombineLatest<T extends readonly unknown[]>(
    sources: [...{ [K in keyof T]: Observable<T[K]> }],
    compareFn?: (a: T, b: T) => boolean
  ): Observable<T> {
    return combineLatest(sources).pipe(
      distinctUntilChanged(compareFn),
      shareReplay(1)
    );
  }

  static createDebouncedObservable<T>(
    source: Observable<T>,
    debounceMs: number = 300
  ): Observable<T> {
    return source.pipe(
      debounceTime(debounceMs),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }
}

// Image Lazy Loading Directive Helper
export class ImageOptimizationHelper {
  static createWebpSource(src: string): string {
    const extension = src.split('.').pop();
    return src.replace(`.${extension}`, '.webp');
  }

  static createResponsiveImageSet(baseSrc: string, sizes: number[]): string {
    return sizes
      .map(size => `${baseSrc}?w=${size} ${size}w`)
      .join(', ');
  }
}

// Bundle Analysis Helper
export interface BundleAnalysis {
  chunkSizes: Map<string, number>;
  duplicateModules: string[];
  unusedExports: string[];
}

export class BundleAnalysisHelper {
  static async analyzeBundleSize(): Promise<BundleAnalysis> {
    // This would integrate with webpack-bundle-analyzer in production
    return {
      chunkSizes: new Map(),
      duplicateModules: [],
      unusedExports: []
    };
  }
}