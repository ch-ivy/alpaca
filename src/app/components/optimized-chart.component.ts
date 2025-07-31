import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
  TrackByFunction
} from '@angular/core';
import { Subject, BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { PerformanceService } from '../services/performance.service';

export interface ChartDataPoint {
  category: string;
  value: number;
  color?: string;
  tooltips?: Array<{ title: string; value: string; color?: string }>;
}

export interface ChartConfig {
  enableVirtualScrolling?: boolean;
  maxDataPoints?: number;
  debounceTime?: number;
  enableDataSampling?: boolean;
  samplingThreshold?: number;
}

@Component({
  selector: 'app-optimized-chart',
  template: `
    <div class="chart-container" #chartContainer>
      <!-- Virtual scrolling for large datasets -->
      @if (config.enableVirtualScrolling && virtualizedData.length > 0) {
        <div class="virtual-scroll-viewport" 
             [style.height.px]="viewportHeight"
             (scroll)="onScroll($event)">
          <div [style.height.px]="totalHeight">
            @for (item of visibleData$ | async; let i = $index; track trackByItem(i, item)) {
              <div class="chart-item"
                   [style.transform]="'translateY(' + (startIndex + i) * itemHeight + 'px)'"
                   [attr.data-category]="item.category">
                <!-- Chart rendering optimized -->
                <div class="chart-bar"
                     [style.width.%]="getBarWidth(item.value)"
                     [style.background-color]="item.color || defaultColor">
                  <span class="chart-label">{{ item.category }}</span>
                  <span class="chart-value">{{ formatValue(item.value) }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- Standard rendering for smaller datasets -->
        <div class="standard-chart">
          @for (item of processedData$ | async; let i = $index; track trackByItem(i, item)) {
            <div class="chart-item" [attr.data-category]="item.category">
              <div class="chart-bar"
                   [style.width.%]="getBarWidth(item.value)"
                   [style.background-color]="item.color || defaultColor"
                   (click)="onItemClick(item)"
                   (mouseenter)="onItemHover(item, $event)"
                   (mouseleave)="onItemLeave()">
                <span class="chart-label">{{ item.category }}</span>
                <span class="chart-value">{{ formatValue(item.value) }}</span>
              </div>
            </div>
          }
        </div>
      }

      <!-- Tooltip -->
      @if (hoveredItem && showTooltip) {
        <div class="chart-tooltip"
             [style.left.px]="tooltipPosition.x"
             [style.top.px]="tooltipPosition.y">
          @for (tooltip of hoveredItem.tooltips; track tooltip.title) {
            <div class="tooltip-row">
              <span class="tooltip-title">{{ tooltip.title }}:</span>
              <span class="tooltip-value" [style.color]="tooltip.color">{{ tooltip.value }}</span>
            </div>
          }
        </div>
      }

      <!-- Loading indicator -->
      @if (isProcessing) {
        <div class="chart-loading">
          <div class="loading-spinner"></div>
          <span>Processing data...</span>
        </div>
      }
    </div>
  `,
  styleUrls: ['./optimized-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OptimizedChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() data: ChartDataPoint[] = [];
  @Input() config: ChartConfig = {};
  @Input() height: number = 400;
  @Input() defaultColor: string = '#4285f4';
  @Input() enableTooltips: boolean = true;

  @Output() itemClick = new EventEmitter<ChartDataPoint>();
  @Output() dataProcessed = new EventEmitter<ChartDataPoint[]>();

  @ViewChild('chartContainer', { static: true }) chartContainer: ElementRef;

  private destroy$ = new Subject<void>();
  private dataSubject$ = new BehaviorSubject<ChartDataPoint[]>([]);
  private resizeSubject$ = new Subject<void>();

  // Virtual scrolling properties
  viewportHeight = 400;
  itemHeight = 40;
  visibleItemCount = 10;
  startIndex = 0;
  endIndex = 10;
  totalHeight = 0;
  virtualizedData: ChartDataPoint[] = [];

  // Tooltip properties
  hoveredItem: ChartDataPoint | null = null;
  showTooltip = false;
  tooltipPosition = { x: 0, y: 0 };

  // Processing state
  isProcessing = false;

  // Track by function for performance
  trackByItem: TrackByFunction<ChartDataPoint> = (index: number, item: ChartDataPoint) => 
    item.category || index;

  // Processed data observables
  processedData$: Observable<ChartDataPoint[]>;
  visibleData$: Observable<ChartDataPoint[]>;

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private performanceService: PerformanceService
  ) {
    // Set default configuration
    this.config = {
      enableVirtualScrolling: false,
      maxDataPoints: 1000,
      debounceTime: 300,
      enableDataSampling: true,
      samplingThreshold: 500,
      ...this.config
    };

    this.setupDataProcessing();
  }

  ngOnInit(): void {
    this.setupViewport();
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      this.performanceService.markStart('chart-data-processing');
      this.dataSubject$.next(this.data);
    }

    if (changes['height']) {
      this.updateViewport();
    }
  }

  private setupDataProcessing(): void {
    // Main data processing pipeline
    this.processedData$ = this.dataSubject$.pipe(
      debounceTime(this.config.debounceTime),
      distinctUntilChanged(),
      map(data => this.processChartData(data)),
      takeUntil(this.destroy$)
    );

    // Virtual scrolling data
    this.visibleData$ = combineLatest([
      this.processedData$,
      this.resizeSubject$.pipe(
        debounceTime(100),
        distinctUntilChanged()
      )
    ]).pipe(
      map(([data]) => this.getVisibleData(data)),
      takeUntil(this.destroy$)
    );

    // Subscribe to processed data for emissions
    this.processedData$.subscribe(data => {
      this.dataProcessed.emit(data);
      this.performanceService.markEnd('chart-data-processing');
      this.isProcessing = false;
      this.cdr.markForCheck();
    });
  }

  private processChartData(data: ChartDataPoint[]): ChartDataPoint[] {
    if (!data || data.length === 0) {
      return [];
    }

    this.isProcessing = true;
    this.cdr.markForCheck();

    let processedData = [...data];

    // Data sampling for large datasets
    if (this.config.enableDataSampling && data.length > this.config.samplingThreshold) {
      processedData = this.sampleData(data);
    }

    // Limit data points
    if (processedData.length > this.config.maxDataPoints) {
      processedData = processedData.slice(0, this.config.maxDataPoints);
    }

    // Sort by value for better visualization
    processedData.sort((a, b) => b.value - a.value);

    // Update virtual scrolling data
    if (this.config.enableVirtualScrolling) {
      this.virtualizedData = processedData;
      this.totalHeight = processedData.length * this.itemHeight;
      this.updateVisibleRange();
    }

    return processedData;
  }

  private sampleData(data: ChartDataPoint[]): ChartDataPoint[] {
    const sampleSize = Math.min(this.config.maxDataPoints, this.config.samplingThreshold);
    const step = Math.floor(data.length / sampleSize);
    
    if (step <= 1) {
      return data;
    }

    const sampled: ChartDataPoint[] = [];
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }

    return sampled;
  }

  private setupViewport(): void {
    this.viewportHeight = this.height;
    this.visibleItemCount = Math.ceil(this.viewportHeight / this.itemHeight);
    this.endIndex = this.visibleItemCount;
    this.updateVisibleRange();
  }

  private setupResizeObserver(): void {
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => {
        this.ngZone.run(() => {
          this.resizeSubject$.next();
        });
      });

      resizeObserver.observe(this.chartContainer.nativeElement);

      // Cleanup on destroy
      this.destroy$.subscribe(() => {
        resizeObserver.disconnect();
      });
    }
  }

  private updateViewport(): void {
    this.viewportHeight = this.height;
    this.visibleItemCount = Math.ceil(this.viewportHeight / this.itemHeight);
    this.updateVisibleRange();
  }

  private updateVisibleRange(): void {
    this.endIndex = Math.min(
      this.startIndex + this.visibleItemCount + 2, // Add buffer
      this.virtualizedData.length
    );
  }

  private getVisibleData(data: ChartDataPoint[]): ChartDataPoint[] {
    if (!this.config.enableVirtualScrolling) {
      return data;
    }

    return this.virtualizedData.slice(this.startIndex, this.endIndex);
  }

  // Event handlers
  onScroll(event: Event): void {
    const scrollTop = (event.target as HTMLElement).scrollTop;
    const newStartIndex = Math.floor(scrollTop / this.itemHeight);
    
    if (newStartIndex !== this.startIndex) {
      this.startIndex = newStartIndex;
      this.updateVisibleRange();
      this.resizeSubject$.next();
    }
  }

  onItemClick(item: ChartDataPoint): void {
    this.itemClick.emit(item);
  }

  onItemHover(item: ChartDataPoint, event: MouseEvent): void {
    if (!this.enableTooltips || !item.tooltips) {
      return;
    }

    this.hoveredItem = item;
    this.showTooltip = true;
    this.tooltipPosition = {
      x: event.clientX + 10,
      y: event.clientY - 10
    };
    this.cdr.markForCheck();
  }

  onItemLeave(): void {
    this.hoveredItem = null;
    this.showTooltip = false;
    this.cdr.markForCheck();
  }

  // Utility methods
  getBarWidth(value: number): number {
    if (!this.virtualizedData.length) {
      return 0;
    }

    const maxValue = Math.max(...this.virtualizedData.map(d => d.value));
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  }

  formatValue(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  // Public API for external optimization
  refreshData(): void {
    this.dataSubject$.next(this.data);
  }

  optimizeForLargeDataset(): void {
    this.config = {
      ...this.config,
      enableVirtualScrolling: true,
      enableDataSampling: true,
      maxDataPoints: 500
    };
    this.refreshData();
  }
}