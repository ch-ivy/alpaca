import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  TrackByFunction,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Store } from '@ngrx/store';
import {
  AxisLabelContentArgs,
  SeriesLabels,
  SeriesLabelsContentArgs,
} from '@progress/kendo-angular-charts';
import { PDFExportComponent } from '@progress/kendo-angular-pdf-export';

import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  Subject,
  take,
  withLatestFrom,
  shareReplay,
  distinctUntilChanged,
  debounceTime,
  startWith,
  switchMap,
  filter,
  takeUntil,
} from 'rxjs';

import { SubscriptionMixin, Memoize, ObservablePerformanceHelper } from './performance-utils';

// Interfaces for type safety
interface ChartDataCache {
  [key: string]: any;
}

interface ComponentState {
  loading: boolean;
  data: any;
  filter: any;
  expandedBlock: any;
}

@Component({
  selector: 'app-optimized-dashboard-report',
  templateUrl: './optimized-dashboard-report.component.html',
  styleUrls: ['./optimized-dashboard-report.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptimizedDashboardReportComponent extends SubscriptionMixin implements OnInit, OnDestroy {
  // ViewChild references
  @ViewChild('top') topElement!: ElementRef;
  @ViewChild('tableTop') tableTopElement!: ElementRef;
  @ViewChild('pdf') pdfRef!: PDFExportComponent;

  // Private subjects for state management
  private readonly expandedBlock$ = new BehaviorSubject<any>(null);
  private readonly chartDataCache: ChartDataCache = {};
  private readonly componentState$ = new BehaviorSubject<ComponentState>({
    loading: false,
    data: null,
    filter: null,
    expandedBlock: null
  });

  // Performance-optimized observables
  readonly loading$ = this.store.select(reportsSelectors.loading).pipe(
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly data$ = this.store.select(reportsSelectors.data).pipe(
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly filter$ = this.store.select(reportsSelectors.filter).pipe(
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Memoized computed observables
  readonly blockData$ = ObservablePerformanceHelper.createMemoizedCombineLatest([
    this.data$,
    this.filter$,
    this.store.select(reportsSelectors.location)
  ]).pipe(
    map(([data, filter, location]) => this.calculateBlockData(data, filter, location)),
    shareReplay(1)
  );

  readonly occupancyChartData$ = ObservablePerformanceHelper.createDebouncedObservable(
    combineLatest([this.data$, this.filter$, this.expandedBlock$]).pipe(
      map(([data, filter, isExpanded]) => this.calculateOccupancyData(data, filter, isExpanded))
    ),
    150
  );

  // TrackBy functions for *ngFor optimization
  readonly trackByTerritory: TrackByFunction<any> = (index, item) => item?.territory || index;
  readonly trackByCategory: TrackByFunction<any> = (index, item) => item?.category || index;
  readonly trackByName: TrackByFunction<any> = (index, item) => item?.name || index;

  constructor(
    public store: Store,
    public ngZone: NgZone,
    private cdRef: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    super();
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  private initializeComponent(): void {
    // Initialize with memoized recent filter
    this.store
      .select(reportsSelectors.recentFilter)
      .pipe(
        take(1),
        this.takeUntilDestroy()
      )
      .subscribe((recentFilter) => {
        const filterToUse = recentFilter || this.getInitFilter();
        this.emitFilter(filterToUse, true);
      });

    // Set up performance monitoring in development mode
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.setupPerformanceMonitoring();
  }

  private setupPerformanceMonitoring(): void {
    if (typeof window !== 'undefined' && window.performance) {
      // Monitor long tasks
      this.ngZone.runOutsideAngular(() => {
        if ('PerformanceObserver' in window) {
          const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry: any) => {
              if (entry.duration > 50) {
                console.warn(`Long task detected: ${entry.duration}ms`);
              }
            });
          });
          observer.observe({ entryTypes: ['longtask'] });
        }
      });
    }
  }

  @Memoize(5000) // Cache for 5 seconds
  private calculateBlockData(data: any, filter: any, location: any): any[] {
    if (!data?.overviewDetails) return [];

    // Expensive calculation cached for 5 seconds
    return [
      {
        title: this.getHeaderTitle(location),
        value: this.getOverviewName(data, filter, location),
      },
      {
        title: 'UNITS',
        value: data.overviewDetails.numUnits,
      },
      {
        title: 'PROPERTIES',
        value: data.overviewDetails.numProperties,
      },
      // ... other block data
    ];
  }

  @Memoize(3000)
  private calculateOccupancyData(data: any, filter: any, isExpanded: any): any[] {
    if (!data?.occupancyHistory) return [];

    const cacheKey = `occupancy_${JSON.stringify({ data: data.occupancyHistory.length, filter: filter?.activeMapPolygon, isExpanded })}`;
    
    if (this.chartDataCache[cacheKey]) {
      return this.chartDataCache[cacheKey];
    }

    // Expensive calculation
    const result = this.processOccupancyHistory(data, filter, isExpanded);
    this.chartDataCache[cacheKey] = result;
    
    return result;
  }

  private processOccupancyHistory(data: any, filter: any, isExpanded: any): any[] {
    // Process occupancy history data
    const normalizedData = this.normalizeData(data.territoryDetails);
    
    let filteredData = data.occupancyHistory
      .filter(x => 
        !filter?.filteredMarkets.has(x.territory.toLowerCase()) &&
        (!isExpanded ? x.territory !== filter.activeMapPolygon : true)
      )
      .sort((a: any, b: any) => a.territory.localeCompare(b.territory));

    if (filter.activeMapPolygon && !isExpanded) {
      const activeData = data.occupancyHistory.find(
        (x: any) => x.territory === filter.activeMapPolygon
      );
      if (activeData) {
        filteredData = [activeData, ...filteredData];
      }
    }

    return filteredData.map((x: any) => ({
      name: x.territory,
      color: normalizedData[x.territory]?.color,
      column: x.monthlyAverages.map((avg: any) => `${this.getMonthByNumber(avg.month)} ${avg.year % 100}`),
      group: x.monthlyAverages.map((avg: any, index: number) => ({
        value: avg.average,
        category: `${this.getMonthByNumber(avg.month)} ${avg.year % 100}`,
        tooltips: this.generateTooltips(avg, index, x.monthlyAverages),
      })),
    }));
  }

  // Optimized event handlers
  activateRow = (territory: string): void => {
    this.ngZone.run(() => {
      this.filter$.pipe(
        take(1),
        this.takeUntilDestroy()
      ).subscribe((filter) => {
        const activeMapPolygon = filter.activeMapPolygon !== territory ? territory : null;
        this.emitFilter({ activeMapPolygon }, false);
      });
    });
  };

  savePDF = (): void => {
    if (!this.pdfRef) return;

    combineLatest([
      this.store.select(reportsSelectors.activeReportType),
      this.store.select(reportsSelectors.locationName)
    ]).pipe(
      take(1),
      this.takeUntilDestroy()
    ).subscribe(([reportType, locationName]) => {
      const fileName = `${reportType}_${locationName}_${Date.now()}`;
      this.downloadService.savePDF(this.pdfRef, fileName);
    });
  };

  clickOutside = (): void => {
    this.emitFilter({ activeMapPolygon: null }, false);
  };

  emitFilter(filter: Partial<any>, fetch: boolean): void {
    this.store.dispatch(
      reportsActions.updateReportFilter({
        payload: { filter }
      })
    );

    if (fetch) {
      this.loadReport();
    }
  }

  private loadReport(): void {
    this.store.select(reportsSelectors.activeReportType).pipe(
      take(1),
      this.takeUntilDestroy()
    ).subscribe(reportType => {
      this.store.dispatch(
        reportsActions.data.getDashboardReport({
          payload: { reportType }
        })
      );
    });
  }

  onExpandBlock = (block: any) => (): void => {
    this.expandedBlock$.next(block);
    
    // Use requestAnimationFrame for smooth scrolling
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.topElement?.nativeElement?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      });
    });
    
    this.cdRef.markForCheck();
  };

  // Helper methods
  @Memoize(10000)
  private getMonthByNumber(month: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || '';
  }

  @Memoize(5000)
  private normalizeData(territoryDetails: any[]): any {
    const normalized: any = {};
    territoryDetails?.forEach((item, index) => {
      normalized[item.territory] = {
        ...item,
        color: this.getColorForIndex(index)
      };
    });
    return normalized;
  }

  private getColorForIndex(index: number): string {
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
    return colors[index % colors.length];
  }

  private generateTooltips(avg: any, index: number, monthlyAverages: any[]): any[] {
    return [
      {
        title: 'Occupancy',
        value: this.formatPercentage(avg.average),
      },
      {
        title: `Variance to Previous Month`,
        value: index === 0 ? '—' : this.formatPercentage(
          monthlyAverages[index - 1].average - avg.average
        ),
        color: index !== 0 ? (
          monthlyAverages[index - 1].average - avg.average > 0 ? '#16a187' : '#fe4d4d'
        ) : null,
      },
    ];
  }

  private formatPercentage(value: number): string {
    return new DecimalPipe('en-US').transform(value * 100, '1.0-1') + '%';
  }

  private getHeaderTitle(location: any): string {
    return location?.metro ? 'SUBMARKETS' : 
           location?.state ? 'METROS' : 'STATES';
  }

  private getOverviewName(data: any, filter: any, location: any): string {
    if (!data?.overviewDetails) return '—';
    
    if (filter?.filteredMarkets?.size) {
      return location?.metro ? location.metro + ' Selected Submarkets' :
             location?.state ? location.state + ' Selected Metros' : 'Selected States';
    }
    
    return data.overviewDetails.name;
  }

  private getInitFilter(): any {
    return {
      // ... default filter configuration
    };
  }

  override ngOnDestroy(): void {
    // Clear cache on destroy
    Object.keys(this.chartDataCache).forEach(key => delete this.chartDataCache[key]);
    
    // Save recent filter before destroying
    this.store.dispatch(reportsActions.saveRecentFilter());
    
    super.ngOnDestroy();
  }
}