import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Observable, Subject, timer, Subscription } from 'rxjs';
import { takeUntil, tap, finalize } from 'rxjs/operators';

export interface MemoryLeakReport {
  timestamp: number;
  memoryUsage: number;
  activeObservables: number;
  activeDOMListeners: number;
  activeTimers: number;
  leakSuspects: string[];
  recommendations: string[];
}

export interface ComponentMetrics {
  componentName: string;
  instanceCount: number;
  memoryFootprint: number;
  observableCount: number;
  createdAt: number;
  lastActivity: number;
}

@Injectable({
  providedIn: 'root'
})
export class MemoryLeakPreventionService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private monitoringInterval$ = timer(0, 30000); // Check every 30 seconds
  private componentRegistry = new Map<string, ComponentMetrics>();
  private observableRegistry = new Set<string>();
  private timerRegistry = new Set<number>();
  private listenerRegistry = new Map<string, () => void>();
  private memoryHistory: number[] = [];
  private maxHistorySize = 20; // Keep last 20 measurements

  // WeakMap to track component instances without preventing GC
  private componentInstances = new WeakMap<object, string>();
  
  // Performance monitoring
  private performanceObserver?: PerformanceObserver;

  constructor(private ngZone: NgZone) {
    this.initializeMonitoring();
    this.setupPerformanceObserver();
  }

  private initializeMonitoring(): void {
    this.ngZone.runOutsideAngular(() => {
      this.monitoringInterval$
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.performMemoryCheck();
        });
    });
  }

  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.entryType === 'measure' && entry.duration > 100) {
            console.warn(`Long task detected: ${entry.name} took ${entry.duration}ms`);
          }
        });
      });

      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
    }
  }

  // Component lifecycle tracking
  registerComponent(component: object, componentName: string): void {
    this.componentInstances.set(component, componentName);
    
    const existing = this.componentRegistry.get(componentName);
    if (existing) {
      existing.instanceCount++;
      existing.lastActivity = Date.now();
    } else {
      this.componentRegistry.set(componentName, {
        componentName,
        instanceCount: 1,
        memoryFootprint: 0,
        observableCount: 0,
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
    }
  }

  unregisterComponent(component: object): void {
    const componentName = this.componentInstances.get(component);
    if (componentName) {
      this.componentInstances.delete(component);
      
      const metrics = this.componentRegistry.get(componentName);
      if (metrics) {
        metrics.instanceCount = Math.max(0, metrics.instanceCount - 1);
        if (metrics.instanceCount === 0) {
          this.componentRegistry.delete(componentName);
        }
      }
    }
  }

  // Observable tracking
  trackObservable<T>(
    observable: Observable<T>, 
    context: string = 'unknown'
  ): Observable<T> {
    const observableId = `${context}-${Date.now()}-${Math.random()}`;
    this.observableRegistry.add(observableId);

    return observable.pipe(
      tap(() => {
        // Update component metrics if available
        const metrics = this.componentRegistry.get(context);
        if (metrics) {
          metrics.observableCount++;
          metrics.lastActivity = Date.now();
        }
      }),
      finalize(() => {
        this.observableRegistry.delete(observableId);
        
        // Update component metrics
        const metrics = this.componentRegistry.get(context);
        if (metrics) {
          metrics.observableCount = Math.max(0, metrics.observableCount - 1);
        }
      })
    );
  }

  // Timer tracking
  trackTimer(timerId: number): void {
    this.timerRegistry.add(timerId);
  }

  untrackTimer(timerId: number): void {
    this.timerRegistry.delete(timerId);
  }

  // DOM Event listener tracking
  trackEventListener(
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): () => void {
    const listenerId = `${event}-${Date.now()}-${Math.random()}`;
    
    target.addEventListener(event, listener, options);
    
    const cleanup = () => {
      target.removeEventListener(event, listener, options);
      this.listenerRegistry.delete(listenerId);
    };
    
    this.listenerRegistry.set(listenerId, cleanup);
    
    return cleanup;
  }

  // Memory analysis
  private performMemoryCheck(): void {
    if (!('memory' in performance)) {
      return;
    }

    const memory = (performance as any).memory;
    const currentMemory = memory.usedJSHeapSize / (1024 * 1024); // MB
    
    this.memoryHistory.push(currentMemory);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Detect memory leaks
    if (this.memoryHistory.length >= 5) {
      const isIncreasing = this.isMemoryIncreasing();
      const hasMemorySpike = this.hasMemorySpike();
      
      if (isIncreasing || hasMemorySpike) {
        this.generateLeakReport();
      }
    }
  }

  private isMemoryIncreasing(): boolean {
    if (this.memoryHistory.length < 5) return false;
    
    const recent = this.memoryHistory.slice(-5);
    const trend = recent.reduce((acc, curr, idx) => {
      if (idx === 0) return acc;
      return acc + (curr - recent[idx - 1]);
    }, 0);
    
    return trend > 10; // 10MB increase trend
  }

  private hasMemorySpike(): boolean {
    if (this.memoryHistory.length < 2) return false;
    
    const current = this.memoryHistory[this.memoryHistory.length - 1];
    const previous = this.memoryHistory[this.memoryHistory.length - 2];
    
    return (current - previous) > 20; // 20MB spike
  }

  // Leak detection and reporting
  generateLeakReport(): MemoryLeakReport {
    const memory = (performance as any).memory;
    const currentMemory = memory?.usedJSHeapSize / (1024 * 1024) || 0;
    
    const leakSuspects = this.identifyLeakSuspects();
    const recommendations = this.generateRecommendations(leakSuspects);
    
    const report: MemoryLeakReport = {
      timestamp: Date.now(),
      memoryUsage: currentMemory,
      activeObservables: this.observableRegistry.size,
      activeDOMListeners: this.listenerRegistry.size,
      activeTimers: this.timerRegistry.size,
      leakSuspects,
      recommendations
    };

    console.warn('Memory leak detected:', report);
    return report;
  }

  private identifyLeakSuspects(): string[] {
    const suspects: string[] = [];
    
    // Check for components with high instance counts
    this.componentRegistry.forEach((metrics, name) => {
      if (metrics.instanceCount > 10) {
        suspects.push(`High instance count for ${name}: ${metrics.instanceCount}`);
      }
      
      if (metrics.observableCount > 50) {
        suspects.push(`High observable count for ${name}: ${metrics.observableCount}`);
      }
      
      // Check for stale components (no activity for 5 minutes)
      const staleThreshold = 5 * 60 * 1000;
      if (Date.now() - metrics.lastActivity > staleThreshold) {
        suspects.push(`Stale component detected: ${name}`);
      }
    });
    
    // Check for excessive active observables
    if (this.observableRegistry.size > 100) {
      suspects.push(`Excessive active observables: ${this.observableRegistry.size}`);
    }
    
    // Check for excessive DOM listeners
    if (this.listenerRegistry.size > 50) {
      suspects.push(`Excessive DOM listeners: ${this.listenerRegistry.size}`);
    }
    
    // Check for excessive timers
    if (this.timerRegistry.size > 20) {
      suspects.push(`Excessive active timers: ${this.timerRegistry.size}`);
    }
    
    return suspects;
  }

  private generateRecommendations(suspects: string[]): string[] {
    const recommendations: string[] = [];
    
    if (suspects.some(s => s.includes('observable'))) {
      recommendations.push('Use takeUntil() operator to unsubscribe from observables');
      recommendations.push('Implement OnDestroy interface in components');
    }
    
    if (suspects.some(s => s.includes('listeners'))) {
      recommendations.push('Remove event listeners in ngOnDestroy');
      recommendations.push('Use Renderer2 for DOM manipulation');
    }
    
    if (suspects.some(s => s.includes('timers'))) {
      recommendations.push('Clear timers and intervals in ngOnDestroy');
    }
    
    if (suspects.some(s => s.includes('instance count'))) {
      recommendations.push('Check for circular references preventing garbage collection');
      recommendations.push('Use OnPush change detection strategy');
    }
    
    recommendations.push('Enable production mode for better performance');
    recommendations.push('Use lazy loading for feature modules');
    
    return recommendations;
  }

  // Cleanup utilities
  cleanupComponent(component: object): void {
    const componentName = this.componentInstances.get(component);
    if (componentName) {
      this.unregisterComponent(component);
      
      // Force cleanup of related resources
      this.forceCleanupByContext(componentName);
    }
  }

  private forceCleanupByContext(context: string): void {
    // Cleanup observables for this context
    const observablesToDelete: string[] = [];
    this.observableRegistry.forEach(id => {
      if (id.includes(context)) {
        observablesToDelete.push(id);
      }
    });
    observablesToDelete.forEach(id => this.observableRegistry.delete(id));
    
    // Cleanup listeners for this context
    const listenersToDelete: string[] = [];
    this.listenerRegistry.forEach((cleanup, id) => {
      if (id.includes(context)) {
        cleanup();
        listenersToDelete.push(id);
      }
    });
    listenersToDelete.forEach(id => this.listenerRegistry.delete(id));
  }

  // Force garbage collection (if available)
  forceGarbageCollection(): void {
    if ('gc' in window) {
      (window as any).gc();
      console.log('Forced garbage collection');
    } else {
      console.warn('Garbage collection not available');
    }
  }

  // Get current statistics
  getMemoryStats(): {
    currentMemory: number;
    memoryTrend: number[];
    activeObservables: number;
    activeListeners: number;
    activeTimers: number;
    componentStats: ComponentMetrics[];
  } {
    const memory = (performance as any).memory;
    const currentMemory = memory?.usedJSHeapSize / (1024 * 1024) || 0;
    
    return {
      currentMemory,
      memoryTrend: [...this.memoryHistory],
      activeObservables: this.observableRegistry.size,
      activeListeners: this.listenerRegistry.size,
      activeTimers: this.timerRegistry.size,
      componentStats: Array.from(this.componentRegistry.values())
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Cleanup all tracked resources
    this.listenerRegistry.forEach(cleanup => cleanup());
    this.listenerRegistry.clear();
    
    this.timerRegistry.forEach(timerId => clearTimeout(timerId));
    this.timerRegistry.clear();
    
    this.observableRegistry.clear();
    this.componentRegistry.clear();
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }
}