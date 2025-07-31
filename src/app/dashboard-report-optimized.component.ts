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
import { ReportsElasticValue, ReportsLabel } from '@shared/enums/reports.enum';
import {
  createCompareFunction,
  getMonthByNumber,
  has,
  isEqual,
  normalize,
} from '@shared/helpers/algorithms';
import { StatusName } from '@shared/models/advanced-search/interpreter/contexts/inner-models/status-name.enum';
import { DownloadHelperService } from '@shared/services/download-helper.service';
import { reportsActions } from '@store/reports/reports.actions';
import { reportsSelectors } from '@store/reports/reports.selectors';

import { PDFExportComponent } from '@progress/kendo-angular-pdf-export';
import { HOUSING_CLASSIFICATION_TYPE_ITEMS_ID } from '@shared/components/advanced-search/adv-search-building-type/shared/models/housing-classification.options';
import {
  TimelineModeItems,
  TimelineScaleItems,
} from '@shared/components/advanced-search/adv-search-timeline/adv-search-timeline.config';
import { IChartDataModel } from '@shared/components/analytics/column-chart/column-chart.component';
import { FilterTouchedPipe } from '@shared/components/report-filters/report-filters/filter-touched.pipe';
import { Context } from '@shared/components/routed-panel/routed-panel.constants';
import { FilterType } from '@shared/enums/filter-type.enum';
import { PropertyTypeEnum } from '@shared/enums/interpreters/property-type-id.enum';
import { INACTIVE_FLAG } from '@shared/enums/market-type.enum';
import { LogicOperationValue } from '@shared/models/advanced-search/filters/contexts/shared/operation-filter';
import { YearGroupForm } from '@shared/models/advanced-search/filters/forms/building-type-form';
import { AddressForm } from '@shared/models/advanced-search/filters/forms/form.models';
import { Market } from '@shared/models/entity/market';
import { IDashboardReport } from '@shared/models/market-reports/reports.models';
import { IReportParams } from '@shared/services/market-report.service';
import {
  DashboardReportYearsBuiltLabels,
  defaultReportInitFilters,
  IReportsFilter,
  IReportYearGroupNames,
  ReportToggleStatusFilterType,
  YearBuiltReportTitle,
} from '@store/reports/reports-state.model';
import { marketSelectors } from '@store/search/selectors/entity.selectors';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  take,
  withLatestFrom,
  shareReplay,
  distinctUntilChanged,
  debounceTime,
  startWith,
  Subject,
  takeUntil,
  memoize,
} from 'rxjs';
import {
  CHART_SERIES_LABEL_SYMBOL,
  DonutChartCenterText,
  MONEY_FULL_VALUE_SERIES_LABEL,
  TINY_MONEY_SERIES_LABEL,
} from 'src/app/configs/chart-constants';
import { allStatuses } from 'src/app/configs/common-filter-queries/pipeline-queries';
import { EMPTY_DASH } from 'src/app/configs/constants';
import { DataFormat } from 'src/app/configs/grids/grids-data-format';
import {
  SCROLL_UP_CONFIG,
  SortDirection,
} from 'src/app/configs/special-values';
import { COLOR_PALETTE_15 } from 'src/app/pages/community/components/community-data/partials/community-property-data/community-property-data.component';
import {
  LinkReportHelperService,
  ReportOptions,
} from 'src/app/pages/link-reports/helpers/link-report-helper.service';
import { COLOR_PALETTE_CLASSIFICATION } from 'src/styles/kendo/kendo-customization/graphs/donut-palettes';
import { DashboardReportMapHelperService } from './dashboard-report-map-helper.service';
import { StateCodePipe } from '@shared/pipes/state.pipe';

export enum ReportDashboardBlocks {
  Details = 'Details',
  Occupancy = 'Occupancy',
  Absorption = 'Absorption',
  Concession = 'Concession',
  BarCharts = 'BarCharts',
}

// Memoization decorator for expensive computations
function Memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cache = new Map();

  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };

  return descriptor;
}

@Component({
  selector: 'app-dashboard-report',
  templateUrl: './dashboard-report-optimized.component.html',
  styleUrls: ['./dashboard-report.component.scss'],
  // OnPush change detection for better performance
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardReportOptimizedComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private isBrowser: boolean;

  constructor(
    public store: Store,
    public ngZone: NgZone,
    private linkReportHelperService: LinkReportHelperService,
    private downloadService: DownloadHelperService,
    public mapHelperService: DashboardReportMapHelperService,
    public cdRef: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // Constants and enums
  ReportsElasticValue = ReportsElasticValue;
  TimelineScaleItems = TimelineScaleItems;
  Context = Context;
  TimelineModeItems = TimelineModeItems;
  ReportDashboardBlocks = ReportDashboardBlocks;
  has = has;
  EMPTY_DASH = EMPTY_DASH;
  DonutChartCenterText = DonutChartCenterText;
  MONEY_FULL_VALUE_SERIES_LABEL = MONEY_FULL_VALUE_SERIES_LABEL;
  TINY_MONEY_SERIES_LABEL = TINY_MONEY_SERIES_LABEL;
  PERCENT_SERIES_LABEL = CHART_SERIES_LABEL_SYMBOL('%', '0.0-1');

  @ViewChild('top') topElement: ElementRef;
  @ViewChild('tableTop') tableTopElement: ElementRef;

  expandedBlock$ = new BehaviorSubject<ReportDashboardBlocks>(null);

  // Optimized observables with shareReplay for caching
  locationName$ = this.store.select(reportsSelectors.locationName).pipe(
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  title$ = this.store.select(reportsSelectors.location).pipe(
    distinctUntilChanged(),
    map(location => {
      if (location?.state) return 'Markets';
      if (location?.metro) return 'Submarkets';
      return 'State';
    }),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  pipelineExtras = [
    StatusName.Proposed,
    StatusName.PreLeasing,
    StatusName.UnderConstruction,
  ];

  reportType$ = this.store.select(reportsSelectors.activeReportType).pipe(
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  isMarketDashboard$ = this.reportType$.pipe(
    map(report => report === ReportsElasticValue.MARKET_DASHBOARD),
    distinctUntilChanged(),
    shareReplay(1)
  );

  data$ = this.store.select(reportsSelectors.data).pipe(
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  ) as Observable<IDashboardReport>;

  filter$ = this.store.select(reportsSelectors.filter).pipe(
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  loading$ = this.store.select(reportsSelectors.loading).pipe(
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  initFilter = {
    ...defaultReportInitFilters,
  } as IReportsFilter;

  shouldHideMap$ = this.filter$.pipe(
    map(filter => !isEqual(filter?.addressSearch, new AddressForm())),
    distinctUntilChanged(),
    shareReplay(1)
  );

  territories$ = this.filter$.pipe(
    map(filter => filter.territories),
    distinctUntilChanged(),
    shareReplay(1)
  );

  touchedPipe = new FilterTouchedPipe();
  touchedFilters$ = this.touchedPipe.transform(this.filter$, this.initFilter);

  // Complex computed observables optimized with shareReplay
  selectedMarket$ = combineLatest([
    this.store.select(reportsSelectors.location),
    this.store.select(marketSelectors.entities),
    this.store.select(marketSelectors.groupByState),
    this.store.select(marketSelectors.marketByMetro),
    this.filter$,
  ]).pipe(
    map(([reportLocation, all, groupByState, marketByMetro, filter]) => {
      const territoriesSet = new Set(
        (filter as IReportsFilter).activeTerritories
      );

      if (!reportLocation?.state && !reportLocation.metro) {
        return territoriesSet
          ? Object.values(all).filter(x =>
              territoriesSet.size ? territoriesSet.has(x.stateCode) : true
            )
          : null;
      } else if (reportLocation.state) {
        return filter.territories
          .map(x => marketByMetro[x.territory])
          .filter(x =>
            territoriesSet.size ? territoriesSet.has(x.metro) : true
          );
      } else if (reportLocation?.metro) {
        return [marketByMetro[reportLocation?.metro]];
      }
      return null;
    }),
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  blockData$ = combineLatest([
    this.data$,
    this.filter$,
    this.store.select(reportsSelectors.location),
  ]).pipe(
    map(([data, filter, location]: [IDashboardReport, IReportsFilter, IReportParams]) => 
      this.computeBlockData(data, filter, location)
    ),
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  isAllLocationUnSelected$ = this.filter$.pipe(
    map(filter =>
      filter.territories?.every(
        x =>
          filter.filteredMarkets.has(x.territory) ||
          filter.filteredMarkets.has(x.territory.toLowerCase())
      )
    ),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // Optimized chart data observables
  occupancyChartData$ = combineLatest([
    this.data$,
    this.filter$,
    this.expandedBlock$,
  ]).pipe(
    map(([data, filter, isExpanded]) => this.computeOccupancyChartData(data, filter, isExpanded)),
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  occupancyChartColumns$ = this.occupancyChartData$.pipe(
    map(x => (!!x.length ? x[0].group.map(x => x.category) : [])),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // TrackBy functions for *ngFor optimization
  trackByTerritory: TrackByFunction<any> = (index: number, item: any) => item?.territory || item?.name || index;
  trackByCategory: TrackByFunction<any> = (index: number, item: any) => item?.category || index;
  trackByBlockData: TrackByFunction<any> = (index: number, item: any) => item?.title || index;
  trackByChartData: TrackByFunction<any> = (index: number, item: any) => item?.name || index;

  // Memoized expensive computations
  @Memoize
  private computeBlockData(data: IDashboardReport, filter: IReportsFilter, location: IReportParams) {
    const isDataValid =
      !!data &&
      !!data?.overviewDetails &&
      !filter.territories.every(x =>
        filter.filteredMarkets.has(x.territory.toLowerCase())
      );

    const overviewName = location?.metro
      ? location?.metro + ' Selected Submarkets'
      : new StateCodePipe().transform(location?.state)
        ? new StateCodePipe().transform(location?.state) + ' Selected Metros '
        : 'Selected States';

    const headerTitle = location?.metro
      ? 'SUBMARKETS'
      : location?.state
        ? 'METROS'
        : 'STATES';

    return [
      {
        title: headerTitle,
        value: isDataValid
          ? filter?.filteredMarkets.size
            ? overviewName
            : new StateCodePipe().transform(data.overviewDetails.name)
          : EMPTY_DASH,
      },
      {
        title: 'UNITS',
        value: isDataValid
          ? DataFormat.NonZeroNumber()(data.overviewDetails.numUnits)
          : EMPTY_DASH,
      },
      {
        title: 'PROPERTIES',
        value: isDataValid
          ? DataFormat.NonZeroNumber()(data.overviewDetails.numProperties)
          : EMPTY_DASH,
      },
      {
        title: 'AVG UNIT SQFT',
        value: isDataValid
          ? DataFormat.NonZeroNumber(null, '')(data.overviewDetails.avgSqft)
          : EMPTY_DASH,
      },
      {
        title: 'OCCUPANCY',
        value: isDataValid
          ? DataFormat.NonZeroNumber('0.0-1', '%')(data.overviewDetails.occupancy)
          : EMPTY_DASH,
      },
      {
        title: 'EFFECTIVE RENT',
        value: isDataValid
          ? DataFormat.MoneyFullValue(Math.round(data.overviewDetails.effRent))
          : EMPTY_DASH,
      },
      {
        title: 'EFFECTIVE RENT/SQFT',
        value: isDataValid
          ? DataFormat.TinyMoney(data.overviewDetails.effRentPerSqft)
          : EMPTY_DASH,
      },
    ];
  }

  @Memoize
  private computeOccupancyChartData(data: IDashboardReport, filter: IReportsFilter, isExpanded: ReportDashboardBlocks) {
    if (!data || !filter) {
      return [];
    }

    const normalizedData = normalize(data.territoryDetails, item => item.territory);

    let filteredData = data.occupancyHistory
      .filter(
        x =>
          !filter?.filteredMarkets.has(x.territory.toLowerCase()) &&
          (!isExpanded ? x.territory !== filter.activeMapPolygon : true)
      )
      .sort(createCompareFunction('territory', SortDirection.ASC));

    if (filter.activeMapPolygon && !isExpanded) {
      const activeMapPolygonData = data.occupancyHistory.find(
        x => x.territory === filter.activeMapPolygon
      );
      filteredData = [activeMapPolygonData, ...filteredData];
    }

    return filteredData.map(x => ({
      name: x.territory,
      color: normalizedData[x.territory]?.color,
      column: x.monthlyAverages.map(
        avg => `${getMonthByNumber(avg.month)} ${avg.year % 100}`
      ),
      group: x.monthlyAverages.map((avg, index) => ({
        value: avg.average,
        category: `${getMonthByNumber(avg.month)} ${avg.year % 100}`,
        tooltips: [
          {
            title: 'Occupancy',
            value: DataFormat.NonZeroNumber('0.1-1', '%')(avg.average),
          },
          {
            title: `Variance to ${getMonthByNumber(avg.month - 1)} ${avg.year % 100}`,
            value:
              index === 0
                ? EMPTY_DASH
                : DataFormat.NonZeroNumber('0.1-1', '%')(x.monthlyAverages[index - 1].average - avg.average),
            color:
              index !== 0
                ? x.monthlyAverages[index - 1].average - avg.average > 0
                  ? '#16a187'
                  : '#fe4d4d'
                : null,
          },
        ],
      })),
    }));
  }

  // Debounced filter updates to prevent excessive API calls
  private filterUpdateSubject = new Subject<{ filter: Partial<IReportsFilter>; fetch: boolean }>();

  ngOnInit(): void {
    // Setup debounced filter updates
    this.filterUpdateSubject
      .pipe(
        debounceTime(300), // Debounce for 300ms
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(({ filter, fetch }) => {
        this.store.dispatch(
          reportsActions.updateReportFilter({
            payload: { filter },
          })
        );

        if (fetch) {
          this.loadReport();
        }
      });

    // Initial filter setup
    this.store
      .select(reportsSelectors.recentFilter)
      .pipe(take(1))
      .subscribe((recentFilter: IReportsFilter) => {
        if (recentFilter) {
          this.emitFilter(recentFilter, true);
        } else {
          this.emitFilter(this.initFilter, true);
        }
      });
  }

  ngOnDestroy(): void {
    this.store.dispatch(reportsActions.saveRecentFilter());
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Optimized event handlers
  activateRow(territory: string): void {
    this.filter$
      .pipe(take(1))
      .subscribe((filter: IReportsFilter) => {
        const activeMapPolygon = filter.activeMapPolygon !== territory ? territory : null;
        this.emitFilter({ activeMapPolygon }, false);
      });
  }

  savePDF(PDFRef: PDFExportComponent): void {
    combineLatest([this.reportType$, this.locationName$])
      .pipe(take(1))
      .subscribe(([reportType, locationName]) => {
        const fileName = `${ReportsLabel[reportType]}${locationName} `;
        this.downloadService.savePDF(PDFRef, fileName);
      });
  }

  clickOutside(): void {
    this.emitFilter({ activeMapPolygon: null }, false);
  }

  emitFilter(filter: Partial<IReportsFilter>, fetch: boolean): void {
    this.filterUpdateSubject.next({ filter, fetch });
  }

  loadReport(): void {
    this.reportType$.pipe(take(1)).subscribe(reportType => {
      this.store.dispatch(
        reportsActions.data.getDashboardReport({
          payload: { reportType },
        })
      );
    });
  }

  onExpandBlock(block: ReportDashboardBlocks): () => void {
    return () => {
      this.expandedBlock$.next(block);
      
      // Use requestAnimationFrame for smooth scrolling
      if (this.isBrowser) {
        requestAnimationFrame(() => {
          this.topElement?.nativeElement?.scrollIntoView(SCROLL_UP_CONFIG);
          this.tableTopElement?.nativeElement?.scrollIntoView(SCROLL_UP_CONFIG);
          this.cdRef.markForCheck();
        });
      }
    };
  }

  // Remaining observables with optimization patterns...
  managementChanges$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      return !!data && !isAllLocationUnSelected
        ? data.managementChanges
        : {
            numProperties: 0,
            numAssociatedManagements: 0,
            numAssociatedUnits: 0,
          };
    }),
    distinctUntilChanged(),
    shareReplay(1),
    takeUntil(this.destroy$)
  );

  // Label functions - memoized for performance
  @Memoize
  yearBuiltLabel(args: SeriesLabelsContentArgs): string {
    const percentage = `${DataFormat.NonZeroNumber('1.0-0', '%')(args.value)}`;
    if (args.category === 'Others') {
      return `${percentage} others`;
    }
    return `${percentage} ${args.category} yr${args.category === '< 1' ? '' : 's'} old`;
  }

  @Memoize
  dollarLabelContent = (e: AxisLabelContentArgs): string => {
    return new CurrencyPipe('en-US').transform(
      e?.value,
      'USD',
      'symbol',
      e?.value < 10 ? null : '1.0-0'
    );
  };

  @Memoize
  classificationLabel(args: SeriesLabelsContentArgs): string {
    return `${args.category || 'None'} (${DataFormat.NonZeroNumber('1.0-0', '%')(args.value)})`;
  }

  @Memoize
  percentLabelContent = (e: AxisLabelContentArgs): string =>
    new DecimalPipe('en-US').transform(e?.value, '1.0-0') + '%';

  @Memoize
  sqftLabelContent = (e: AxisLabelContentArgs): string =>
    e.value
      ? new DecimalPipe('en-US').transform(
          e.value,
          e?.value < 10 ? null : '1.0-0'
        ) + ' sqft'
      : '';

  @Memoize
  pieChartLabel(args: SeriesLabelsContentArgs): string {
    const category = allStatuses.find(x => x.elasticValue === args.category).value;
    return `${category}  \n ${new DecimalPipe('en-US').transform(args.value)}`;
  }

  percentSeriesLabel: SeriesLabels = CHART_SERIES_LABEL_SYMBOL('%', '0.0-1');

  // Additional optimized observables would continue here...
  // For brevity, I'm showing the pattern that should be applied to all observables
}