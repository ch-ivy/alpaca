import { 
  Observable, 
  OperatorFunction, 
  MonoTypeOperatorFunction,
  pipe,
  timer,
  EMPTY,
  defer,
  throwError,
  BehaviorSubject,
  Subject,
  combineLatest,
  merge
} from 'rxjs';
import {
  map,
  filter,
  distinctUntilChanged,
  shareReplay,
  takeUntil,
  debounceTime,
  throttleTime,
  switchMap,
  mergeMap,
  exhaustMap,
  catchError,
  retry,
  finalize,
  tap,
  startWith,
  pairwise,
  scan,
  bufferTime,
  windowTime,
  sample
} from 'rxjs/operators';

/**
 * Custom operator for memory-efficient data caching
 */
export function cacheWithExpiry<T>(
  expiryTime: number = 300000, // 5 minutes default
  bufferSize: number = 1
): MonoTypeOperatorFunction<T> {
  return pipe(
    shareReplay({
      bufferSize,
      refCount: true,
      windowTime: expiryTime
    }),
    finalize(() => {
      // Cleanup on unsubscribe
      console.debug('Cache expired and cleaned up');
    })
  );
}

/**
 * Optimized debounce with immediate first emission
 */
export function smartDebounce<T>(
  dueTime: number,
  emitImmediate: boolean = true
): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    return defer(() => {
      let hasEmitted = false;
      
      return source.pipe(
        tap(() => {
          if (emitImmediate && !hasEmitted) {
            hasEmitted = true;
          }
        }),
        debounceTime(dueTime),
        distinctUntilChanged()
      );
    });
  };
}

/**
 * Adaptive throttling based on system performance
 */
export function adaptiveThrottle<T>(
  baseDelay: number = 100
): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    return defer(() => {
      let dynamicDelay = baseDelay;
      
      return source.pipe(
        tap(() => {
          // Adjust delay based on performance
          const memory = (performance as any).memory;
          if (memory && memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
            dynamicDelay = Math.min(baseDelay * 2, 1000);
          } else {
            dynamicDelay = baseDelay;
          }
        }),
        throttleTime(dynamicDelay, undefined, { leading: true, trailing: true })
      );
    });
  };
}

/**
 * Smart retry with exponential backoff
 */
export function smartRetry<T>(
  maxRetries: number = 3,
  backoffDelay: number = 1000
): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return source.pipe(
      retry({
        count: maxRetries,
        delay: (error, retryCount) => {
          const delay = backoffDelay * Math.pow(2, retryCount - 1);
          console.warn(`Retrying after ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          return timer(delay);
        }
      }),
      catchError(error => {
        console.error('Max retries exceeded:', error);
        return throwError(() => error);
      })
    );
  };
}

/**
 * Memory-efficient data sampling for large datasets
 */
export function sampleLargeData<T>(
  threshold: number = 1000,
  sampleRate: number = 0.1
): OperatorFunction<T[], T[]> {
  return map(data => {
    if (!Array.isArray(data) || data.length <= threshold) {
      return data;
    }

    const sampleSize = Math.max(Math.floor(data.length * sampleRate), 100);
    const step = Math.floor(data.length / sampleSize);
    
    const sampled: T[] = [];
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    
    return sampled;
  });
}

/**
 * Performance monitoring operator
 */
export function trackPerformance<T>(
  operationName: string
): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    return defer(() => {
      const startTime = performance.now();
      
      return source.pipe(
        tap({
          next: () => {
            const duration = performance.now() - startTime;
            if (duration > 100) { // Log slow operations
              console.warn(`Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms`);
            }
          },
          error: () => {
            const duration = performance.now() - startTime;
            console.error(`Operation failed: ${operationName} after ${duration.toFixed(2)}ms`);
          }
        }),
        finalize(() => {
          const duration = performance.now() - startTime;
          console.debug(`Operation completed: ${operationName} in ${duration.toFixed(2)}ms`);
        })
      );
    });
  };
}

/**
 * Optimized combineLatest for multiple observables with caching
 */
export function combineLatestCached<T extends readonly unknown[]>(
  ...sources: [...ObservableInputArray<T>]
): Observable<T> {
  return combineLatest(sources).pipe(
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
    shareReplay(1)
  );
}

/**
 * Memory-safe switchMap with cancellation
 */
export function safeSwitchMap<T, R>(
  project: (value: T) => Observable<R>,
  maxConcurrent: number = 1
): OperatorFunction<T, R> {
  return (source: Observable<T>) => {
    let activeCount = 0;
    
    return source.pipe(
      switchMap(value => {
        if (activeCount >= maxConcurrent) {
          return EMPTY; // Skip if too many concurrent operations
        }
        
        activeCount++;
        return project(value).pipe(
          finalize(() => {
            activeCount--;
          })
        );
      })
    );
  };
}

/**
 * Chunked processing for large data arrays
 */
export function processInChunks<T, R>(
  processor: (chunk: T[]) => Observable<R[]>,
  chunkSize: number = 100
): OperatorFunction<T[], R[]> {
  return (source: Observable<T[]>) => {
    return source.pipe(
      switchMap(data => {
        if (data.length <= chunkSize) {
          return processor(data);
        }

        const chunks: T[][] = [];
        for (let i = 0; i < data.length; i += chunkSize) {
          chunks.push(data.slice(i, i + chunkSize));
        }

        // Process chunks sequentially to avoid memory issues
        return chunks.reduce((acc, chunk) => {
          return acc.pipe(
            switchMap(results => 
              processor(chunk).pipe(
                map(chunkResults => [...results, ...chunkResults])
              )
            )
          );
        }, processor([]).pipe(startWith([] as R[])));
      })
    );
  };
}

/**
 * Optimized filter with memoization
 */
export function memoizedFilter<T>(
  predicate: (value: T) => boolean,
  keySelector?: (value: T) => string
): OperatorFunction<T, T> {
  const cache = new Map<string, boolean>();
  
  return filter(value => {
    const key = keySelector ? keySelector(value) : JSON.stringify(value);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = predicate(value);
    cache.set(key, result);
    
    // Limit cache size to prevent memory leaks
    if (cache.size > 1000) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  });
}

/**
 * Resource cleanup utility
 */
export class SubscriptionManager {
  private subscriptions = new Set<() => void>();
  private destroy$ = new Subject<void>();

  add(teardown: () => void): void {
    this.subscriptions.add(teardown);
  }

  addObservable<T>(observable: Observable<T>): Observable<T> {
    return observable.pipe(takeUntil(this.destroy$));
  }

  destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    this.subscriptions.forEach(teardown => teardown());
    this.subscriptions.clear();
  }

  get isDestroyed(): boolean {
    return this.destroy$.closed;
  }
}

/**
 * Performance-optimized state management
 */
export class OptimizedStateManager<T> {
  private state$ = new BehaviorSubject<T | null>(null);
  private updates$ = new Subject<Partial<T>>();
  
  constructor(initialState?: T) {
    if (initialState) {
      this.state$.next(initialState);
    }

    // Batch state updates for performance
    this.updates$.pipe(
      bufferTime(16), // ~60fps
      filter(updates => updates.length > 0),
      map(updates => updates.reduce((acc, update) => ({ ...acc, ...update }), {} as Partial<T>))
    ).subscribe(batchedUpdates => {
      const currentState = this.state$.value;
      if (currentState) {
        this.state$.next({ ...currentState, ...batchedUpdates });
      }
    });
  }

  get state(): Observable<T> {
    return this.state$.pipe(
      filter(state => state !== null),
      distinctUntilChanged()
    ) as Observable<T>;
  }

  update(updates: Partial<T>): void {
    this.updates$.next(updates);
  }

  select<K extends keyof T>(key: K): Observable<T[K]> {
    return this.state.pipe(
      map(state => state[key]),
      distinctUntilChanged()
    );
  }

  destroy(): void {
    this.state$.complete();
    this.updates$.complete();
  }
}

// Type helpers
type ObservableInputArray<T> = {
  [K in keyof T]: Observable<T[K]>
};

export {
  cacheWithExpiry,
  smartDebounce,
  adaptiveThrottle,
  smartRetry,
  sampleLargeData,
  trackPerformance,
  combineLatestCached,
  safeSwitchMap,
  processInChunks,
  memoizedFilter,
  SubscriptionManager,
  OptimizedStateManager
};