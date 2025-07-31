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
  OnChanges,
  SimpleChanges,
} from '@angular/core';
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
  startWith,
  switchMap,
  filter,
  debounceTime,
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

// Memoized functions for better performance
const memoizedYearBuiltLabel = memoize((category: string, value: number): string => {
  let percentage = `${DataFormat.NonZeroNumber('1.0-0', '%')(value)}`;
  if (category === 'Others') {
    return `${percentage} others`;
  }
  return `${percentage} ${category} yr${category === '< 1' ? '' : 's'} old`;
});

const memoizedClassificationLabel = memoize((category: string, value: number): string => {
  return `${category || 'None'} (${DataFormat.NonZeroNumber('1.0-0', '%')(value)})`;
});

const memoizedPieChartLabel = memoize((category: string, value: number): string => {
  const statusItem = allStatuses.find(x => x.elasticValue === category);
  const categoryValue = statusItem ? statusItem.value : category;
  return `${categoryValue}  \n ${new DecimalPipe('en-US').transform(value)}`;
});

@Component({
  selector: 'app-dashboard-report',
  templateUrl: './dashboard-report.component.html',
  styleUrls: ['./dashboard-report.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardReportComponent implements OnInit, OnDestroy {
  constructor(
    public store: Store,
    public ngZone: NgZone,
    private linkReportHelperService: LinkReportHelperService,
    private downloadService: DownloadHelperService,
    public mapHelperService: DashboardReportMapHelperService,
    public cdRef: ChangeDetectorRef
  ) {}

  // Static properties - moved outside constructor for better performance
  static readonly ReportsElasticValue = ReportsElasticValue;
  static readonly TimelineScaleItems = TimelineScaleItems;
  static readonly Context = Context;
  static readonly TimelineModeItems = TimelineModeItems;
  static readonly ReportDashboardBlocks = ReportDashboardBlocks;
  static readonly has = has;
  static readonly EMPTY_DASH = EMPTY_DASH;
  static readonly DonutChartCenterText = DonutChartCenterText;
  static readonly MONEY_FULL_VALUE_SERIES_LABEL = MONEY_FULL_VALUE_SERIES_LABEL;
  static readonly TINY_MONEY_SERIES_LABEL = TINY_MONEY_SERIES_LABEL;
  static readonly PERCENT_SERIES_LABEL = CHART_SERIES_LABEL_SYMBOL('%', '0.0-1');

  // Expose static properties for template access
  ReportsElasticValue = DashboardReportComponent.ReportsElasticValue;
  TimelineScaleItems = DashboardReportComponent.TimelineScaleItems;
  Context = DashboardReportComponent.Context;
  TimelineModeItems = DashboardReportComponent.TimelineModeItems;
  ReportDashboardBlocks = DashboardReportComponent.ReportDashboardBlocks;
  has = DashboardReportComponent.has;
  EMPTY_DASH = DashboardReportComponent.EMPTY_DASH;
  DonutChartCenterText = DashboardReportComponent.DonutChartCenterText;
  MONEY_FULL_VALUE_SERIES_LABEL = DashboardReportComponent.MONEY_FULL_VALUE_SERIES_LABEL;
  TINY_MONEY_SERIES_LABEL = DashboardReportComponent.TINY_MONEY_SERIES_LABEL;
  PERCENT_SERIES_LABEL = DashboardReportComponent.PERCENT_SERIES_LABEL;

  @ViewChild('top') topElement: ElementRef;
  @ViewChild('tableTop') tableTopElement: ElementRef;

  expandedBlock$ = new BehaviorSubject<ReportDashboardBlocks>(null);
  locationName$ = this.store.select(reportsSelectors.locationName).pipe(
    shareReplay(1)
  );

  title$ = this.store.select(reportsSelectors.location).pipe(
    map(location => {
      if (location?.state) {
        return 'Markets';
      }
      if (location?.metro) {
        return 'Submarkets';
      }
      return 'State';
    }),
    shareReplay(1)
  );

  pipelineExtras = [
    StatusName.Proposed,
    StatusName.PreLeasing,
    StatusName.UnderConstruction,
  ];

  reportType$ = this.store.select(reportsSelectors.activeReportType).pipe(
    shareReplay(1)
  );
  
  isMarketDashboard$ = this.reportType$.pipe(
    map(report => report === ReportsElasticValue.MARKET_DASHBOARD),
    shareReplay(1)
  );

  data$ = this.store.select(reportsSelectors.data).pipe(
    shareReplay(1)
  ) as Observable<IDashboardReport>;

  filter$ = this.store.select(reportsSelectors.filter).pipe(
    shareReplay(1)
  );

  loading$ = this.store.select(reportsSelectors.loading).pipe(
    shareReplay(1)
  );

  initFilter = {
    ...defaultReportInitFilters,
  } as IReportsFilter;

  shouldHideMap$ = this.filter$.pipe(
    map(filter => !isEqual(filter?.addressSearch, new AddressForm())),
    shareReplay(1)
  );

  territories$ = this.filter$.pipe(
    map(filter => filter.territories),
    shareReplay(1)
  );

  touchedPipe = new FilterTouchedPipe();
  touchedFilters$ = this.touchedPipe.transform(this.filter$, this.initFilter).pipe(
    shareReplay(1)
  );

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
    shareReplay(1)
  );

  blockData$ = combineLatest([
    this.data$,
    this.filter$,
    this.store.select(reportsSelectors.location),
  ]).pipe(
    map(
      ([data, filter, location]: [
        IDashboardReport,
        IReportsFilter,
        IReportParams,
      ]) => {
        const isDataValid =
          !!data &&
          !!data?.overviewDetails &&
          !filter.territories.every(x =>
            filter.filteredMarkets.has(x.territory.toLowerCase())
          );

        const overviewName = location?.metro
          ? location?.metro + ' Selected Submarkets'
          : new StateCodePipe().transform(location?.state)
            ? new StateCodePipe().transform(location?.state) +
              ' Selected Metros '
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
              ? DataFormat.NonZeroNumber(
                  '0.0-1',
                  '%'
                )(data.overviewDetails.occupancy)
              : EMPTY_DASH,
          },
          {
            title: 'EFFECTIVE RENT',
            value: isDataValid
              ? DataFormat.MoneyFullValue(
                  Math.round(data.overviewDetails.effRent)
                )
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
    ),
    shareReplay(1)
  );

  isAllLocationUnSelected$ = this.filter$.pipe(
    map(filter =>
      filter.territories?.every(
        x =>
          filter.filteredMarkets.has(x.territory) ||
          filter.filteredMarkets.has(x.territory.toLowerCase())
      )
    ),
    shareReplay(1)
  );

  // Optimized observables with memoization and caching
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
    shareReplay(1)
  );

  newInTown$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      return !!data && !isAllLocationUnSelected
        ? data.newInTown
        : {
            numAssociatedProperties: 0,
            numManagements: 0,
            numAssociatedUnits: 0,
          };
    }),
    shareReplay(1)
  );

  nowLeasing$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      return !!data && !isAllLocationUnSelected
        ? data.nowLeasing
        : {
            numProperties: 0,
            numAssociatedManagements: 0,
            numAssociatedUnits: 0,
          };
    }),
    shareReplay(1)
  );

  managerChanges$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      return !!data && !isAllLocationUnSelected
        ? data.managerChanges?.onsiteManagerChanges
        : 0;
    }),
    shareReplay(1)
  );

  regionalChanges$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      return !!data && !isAllLocationUnSelected
        ? data.managerChanges?.regionalSupervisorChanges
        : 0;
    }),
    shareReplay(1)
  );

  pipeline$ = combineLatest([
    this.data$,
    this.store.select(reportsSelectors.location),
    this.isAllLocationUnSelected$
  ]).pipe(
    map(([data, location, isAllLocationUnSelected]) => {
      const locationName = location?.state
        ? 'Metros'
        : location?.metro
          ? 'Submarkets'
          : 'States';

      if (!data || !data?.pipelineDetails || isAllLocationUnSelected) {
        return {
          length: `0 ${locationName}`,
          piechart: [],
          numProperties: 0,
          numUnits: 0,
          numUnderConstruction: 0,
          numPreLeasing: 0,
          numProposed: 0,
        };
      }

      return {
        length: `${data.pipelineDetails.numTerritories} ${locationName}`,
        numProperties: data.pipelineDetails.numProperties,
        numUnits: data.pipelineDetails.numUnits,
        numUnderConstruction: data.pipelineDetails.numUnderConstruction,
        numPreLeasing: data.pipelineDetails.numPreLeasing,
        numProposed: data.pipelineDetails.numProposed,
        piechart: [
          {
            category: StatusName.Proposed,
            value: data.pipelineDetails.numProposed,
            color: '#51b7a4',
          },
          {
            category: StatusName.UnderConstruction,
            value: data.pipelineDetails.numUnderConstruction,
            color: '#e88d12',
          },
          {
            category: StatusName.PreLeasing,
            value: data.pipelineDetails.numPreLeasing,
            color: '#c07fb8',
          },
        ],
      };
    }),
    shareReplay(1)
  );

  occupancyChartData$ = combineLatest([
    this.data$,
    this.filter$,
    this.expandedBlock$,
  ]).pipe(
    map(([data, filter, isExpanded]) => {
      if (!data || !filter) {
        return [];
      }

      const normalizedData = normalize(
        data.territoryDetails,
        item => item.territory
      );

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
                  : DataFormat.NonZeroNumber(
                      '0.1-1',
                      '%'
                    )(x.monthlyAverages[index - 1].average - avg.average),
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
    }),
    shareReplay(1)
  );

  occupancyChartColumns$ = this.occupancyChartData$.pipe(
    map(x => (!!x.length ? x[0].group.map(x => x.category) : [])),
    shareReplay(1)
  );

  classifications$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      if (!data || !data?.classifications || isAllLocationUnSelected) {
        return [];
      }

      const grouped = {};

      for (const [key, value] of Object.entries(data?.classifications)) {
        const cleanKey = key?.trim() || 'None';
        const groupKey =
          cleanKey === 'None' ? 'None' : cleanKey.charAt(0).toUpperCase();

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            category: groupKey,
            value: 0,
            tooltips: [],
            color: COLOR_PALETTE_CLASSIFICATION[key] ?? '#cccccc',
          };
        }

        grouped[groupKey].value += value;
        grouped[groupKey].tooltips.push({
          title: key,
          value: `${DataFormat.Decimal('0.0-1', '%')(value)}`,
        });
      }

      return Object.values(grouped);
    }),
    shareReplay(1)
  );

  yearsBuilt$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      if (!data || !data?.yearBuiltDetails || isAllLocationUnSelected) {
        return [];
      }

      let percentageArray = [];

      Object.entries(data.yearBuiltDetails).forEach(([key, value]) => {
        if (has(DashboardReportYearsBuiltLabels, key)) {
          const category = DashboardReportYearsBuiltLabels[key];

          const hash = category.split('').reduce((a, b) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
          }, 0);

          const colorIndex = Math.abs(hash) % COLOR_PALETTE_15.length;

          percentageArray.push({
            category:
              DashboardReportYearsBuiltLabels[key] === 'Others'
                ? 'Others'
                : DashboardReportYearsBuiltLabels[key] + ' years old',
            value: value.numPropertiesPercentage,
            color: COLOR_PALETTE_15[colorIndex],
            tooltips: [
              {
                title: 'Number of properties',
                value: DataFormat.Decimal()(
                  data.yearBuiltDetails[key].numProperties
                ),
              },
            ],
          });
        }
      });

      return percentageArray;
    }),
    shareReplay(1)
  );

  avgRentandEffRent$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      if (!data || isAllLocationUnSelected) {
        return [];
      }

      return [
        {
          name: 'Avg Rent',
          group: [
            {
              category: IReportYearGroupNames.FiveOrLess,
              value: data.currentRentsAndOccupancies.fiveOrLessYear.rent,
              tooltips: [
                {
                  title: 'Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.fiveOrLessYear.rent
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.SixToTen,
              value: data.currentRentsAndOccupancies.sixToTenYear.rent,
              tooltips: [
                {
                  title: 'Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.sixToTenYear.rent
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.ElevenToTwenty,
              value: data.currentRentsAndOccupancies.elevenToTwentyYear.rent,
              tooltips: [
                {
                  title: 'Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.elevenToTwentyYear.rent
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.TwentyOnePlus,
              value: data.currentRentsAndOccupancies.twentyOneOrMoreYear.rent,
              tooltips: [
                {
                  title: 'Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.twentyOneOrMoreYear.rent
                  ),
                },
              ],
            },
          ],

          color: '#512da8',
        },
        {
          name: 'Avg Eff. Rent',
          group: [
            {
              category: IReportYearGroupNames.FiveOrLess,
              value: data.currentRentsAndOccupancies.fiveOrLessYear.effRent,
              tooltips: [
                {
                  title: 'Eff. Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.fiveOrLessYear.effRent
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.SixToTen,
              value: data.currentRentsAndOccupancies.sixToTenYear.effRent,
              tooltips: [
                {
                  title: 'Eff. Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.sixToTenYear.effRent
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.ElevenToTwenty,
              value: data.currentRentsAndOccupancies.elevenToTwentyYear.effRent,
              tooltips: [
                {
                  title: 'Eff. Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.elevenToTwentyYear.effRent
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.TwentyOnePlus,
              value:
                data.currentRentsAndOccupancies.twentyOneOrMoreYear.effRent,
              tooltips: [
                {
                  title: 'Eff. Rent',
                  value: DataFormat.MoneyFullValue(
                    data.currentRentsAndOccupancies.twentyOneOrMoreYear.effRent
                  ),
                },
              ],
            },
          ],
          color: '#ba68c8',
        },
      ];
    }),
    shareReplay(1)
  );

  avgRentandEffRentSqft$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      if (!data || isAllLocationUnSelected) {
        return [];
      }

      return [
        {
          name: 'Avg $/Sqft',
          group: [
            {
              category: IReportYearGroupNames.FiveOrLess,
              value: data.currentRentsAndOccupancies.fiveOrLessYear.rentPerSqft,
              tooltips: [
                {
                  title: 'Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.fiveOrLessYear.rentPerSqft
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.SixToTen,
              value: data.currentRentsAndOccupancies.sixToTenYear.rentPerSqft,
              tooltips: [
                {
                  title: 'Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.sixToTenYear.rentPerSqft
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.ElevenToTwenty,
              value:
                data.currentRentsAndOccupancies.elevenToTwentyYear.rentPerSqft,
              tooltips: [
                {
                  title: 'Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.elevenToTwentyYear
                      .rentPerSqft
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.TwentyOnePlus,
              value:
                data.currentRentsAndOccupancies.twentyOneOrMoreYear.rentPerSqft,
              tooltips: [
                {
                  title: 'Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.twentyOneOrMoreYear
                      .rentPerSqft
                  ),
                },
              ],
            },
          ],
          color: '#512da8',
        },
        {
          name: 'Avg Eff. $/Sqft',
          group: [
            {
              category: IReportYearGroupNames.FiveOrLess,
              value:
                data.currentRentsAndOccupancies.fiveOrLessYear.effRentPerSqft,
              tooltips: [
                {
                  title: 'Eff. Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.fiveOrLessYear
                      .effRentPerSqft
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.SixToTen,
              value:
                data.currentRentsAndOccupancies.sixToTenYear.effRentPerSqft,
              tooltips: [
                {
                  title: 'Eff. Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.sixToTenYear.effRentPerSqft
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.ElevenToTwenty,
              value:
                data.currentRentsAndOccupancies.elevenToTwentyYear
                  .effRentPerSqft,
              tooltips: [
                {
                  title: 'Eff. Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.elevenToTwentyYear
                      .effRentPerSqft
                  ),
                },
              ],
            },
            {
              category: IReportYearGroupNames.TwentyOnePlus,
              value:
                data.currentRentsAndOccupancies.twentyOneOrMoreYear
                  .effRentPerSqft,
              tooltips: [
                {
                  title: 'Eff. Rent/Sqft',
                  value: DataFormat.TinyMoney(
                    data.currentRentsAndOccupancies.twentyOneOrMoreYear
                      .effRentPerSqft
                  ),
                },
              ],
            },
          ],
          color: '#ba68c8',
        },
      ];
    }),
    shareReplay(1)
  );

  avgOccupancy$ = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]) => {
      if (!data || isAllLocationUnSelected) {
        return [];
      }

      const lessthan5 =
        data.currentRentsAndOccupancies.fiveOrLessYear.occupancy;

      const sixto10 = data.currentRentsAndOccupancies.sixToTenYear.occupancy;

      const elevenplus =
        data.currentRentsAndOccupancies.elevenToTwentyYear.occupancy;

      const twentyOnePlus =
        data.currentRentsAndOccupancies.twentyOneOrMoreYear.occupancy;

      return [
        {
          name: 'Avg Occupancy',
          group: [
            {
              category: IReportYearGroupNames.FiveOrLess,
              value: lessthan5,
              tooltips: [
                {
                  title: 'Occupancy',
                  value: DataFormat.NonZeroNumber('1.0-0', '%')(lessthan5),
                },
              ],
            },
            {
              category: IReportYearGroupNames.SixToTen,
              value: sixto10,
              tooltips: [
                {
                  title: 'Occupancy',
                  value: DataFormat.NonZeroNumber('1.0-0', '%')(sixto10),
                },
              ],
            },
            {
              category: IReportYearGroupNames.ElevenToTwenty,
              value: elevenplus,
              tooltips: [
                {
                  title: 'Occupancy',
                  value: DataFormat.NonZeroNumber('1.0-0', '%')(elevenplus),
                },
              ],
            },
            {
              category: IReportYearGroupNames.TwentyOnePlus,
              value: twentyOnePlus,
              tooltips: [
                {
                  title: 'Occupancy',
                  value: DataFormat.NonZeroNumber('1.0-0', '%')(twentyOnePlus),
                },
              ],
            },
          ],
          color: '#512da8',
        },
      ];
    }),
    shareReplay(1)
  );

  currentAvgEffRent$: Observable<IChartDataModel[]> = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]: [IDashboardReport, boolean]) => {
      if (!data || isAllLocationUnSelected) {
        return [];
      }

      return [
        {
          name: 'Avg Rent',
          color: '#512da8',
          group: data.currentAverageEffectiveRents.map(rents => {
            const category = `${rents.bed}br, ${rents.bath}ba`;

            return {
              category,
              value: rents.rent,
              tooltips: [
                {
                  title: 'Rent:',
                  value: DataFormat.MoneyFullValue(rents.rent),
                },
              ],
            };
          }),
        },
        {
          name: 'Avg Eff Rent',
          color: '#a76ae8',
          group: data.currentAverageEffectiveRents.map(rents => {
            const category = `${rents.bed}br, ${rents.bath}ba`;

            return {
              category,
              value: rents.effRent,
              tooltips: [
                {
                  title: 'Eff. Rent:',
                  value: DataFormat.MoneyFullValue(rents.effRent),
                },
              ],
            };
          }),
        },
      ];
    }),
    shareReplay(1)
  );

  currentAvgEffRentPerSqft$: Observable<IChartDataModel[]> = combineLatest([this.data$, this.isAllLocationUnSelected$]).pipe(
    map(([data, isAllLocationUnSelected]: [IDashboardReport, boolean]) => {
      if (!data || isAllLocationUnSelected) {
        return [];
      }
      return [
        {
          name: 'Avg $/Sqft',
          color: '#512da8',
          group: data.currentAverageEffectiveRents.map(rents => {
            const category = `${rents.bed}br, ${rents.bath}ba`;

            return {
              category,
              value: rents.rentPerSqft,
              tooltips: [
                {
                  title: 'Rent/Sqft:',
                  value: DataFormat.TinyMoney(rents.rentPerSqft),
                },
              ],
            };
          }),
        },
        {
          name: 'Avg Eff $/Sqft',
          color: '#a76ae8',
          group: data.currentAverageEffectiveRents.map(rents => {
            const category = `${rents.bed}br, ${rents.bath}ba`;

            return {
              category,
              value: rents.effRentPerSqft,
              tooltips: [
                {
                  title: 'Eff. Rent/Sqft:',
                  value: DataFormat.TinyMoney(rents.effRentPerSqft),
                },
              ],
            };
          }),
        },
      ];
    }),
    shareReplay(1)
  );

  currentAvgSqft$: Observable<IChartDataModel[]> = combineLatest([
    this.data$,
    this.filter$,
  ]).pipe(
    withLatestFrom(this.isAllLocationUnSelected$),
    map(
      ([[data, filter], isAllLocationUnSelected]: [
        [IDashboardReport, IReportsFilter],
        boolean,
      ]) => {
        if (!data || isAllLocationUnSelected) {
          return [];
        }
        return [
          {
            name: 'Avg Sqft',
            color: '#a76ae8',
            group: data.currentAverageEffectiveRents.map(rents => {
              const category = `${rents.bed}br, ${rents.bath}ba`;

              return {
                category,
                value: rents.avgSqft,
                tooltips: [
                  {
                    title: 'Sqft:',
                    value: DataFormat.NonZeroNumber(
                      '1.0-0',
                      'ft²'
                    )(rents.avgSqft),
                  },
                ],
              };
            }),
          },
        ];
      }
    ),
    shareReplay(1)
  );

  MoMTimeFrame$ = this.data$.pipe(
    map(data => {
      if (!data) {
        return '';
      }
      const timeData = data.territoryDetails[0].monthlyConcessions;
      return `${getMonthByNumber(timeData[1].month)} - ${getMonthByNumber(timeData[0].month)}`;
    }),
    shareReplay(1)
  );

  percentSeriesLabel: SeriesLabels = CHART_SERIES_LABEL_SYMBOL('%', '0.0-1');

  // Optimized label functions using memoization
  yearBuiltLabel(args: SeriesLabelsContentArgs): string {
    return memoizedYearBuiltLabel(args.category, args.value);
  }

  dollarLabelContent = (e: AxisLabelContentArgs): string => {
    return new CurrencyPipe('en-US').transform(
      e?.value,
      'USD',
      'symbol',
      e?.value < 10 ? null : '1.0-0'
    );
  };

  classificationLabel(args: SeriesLabelsContentArgs): string {
    return memoizedClassificationLabel(args.category, args.value);
  }

  percentLabelContent = (e: AxisLabelContentArgs): string => {
    return new DecimalPipe('en-US').transform(e?.value, '1.0-0') + '%';
  };

  sqftLabelContent = (e: AxisLabelContentArgs): string =>
    e.value
      ? new DecimalPipe('en-US').transform(
          e.value,
          e?.value < 10 ? null : '1.0-0'
        ) + ' sqft'
      : '';

  pieChartLabel(args: SeriesLabelsContentArgs): string {
    return memoizedPieChartLabel(args.category, args.value);
  }

  // Track by functions for better performance
  trackByTerritory: TrackByFunction<any> = (index: number, item: any): string => {
    return item?.territory || index;
  };

  trackByCategory: TrackByFunction<any> = (index: number, item: any): string => {
    return item?.category || index;
  };

  trackByIndex: TrackByFunction<any> = (index: number): number => {
    return index;
  };

  ngOnInit(): void {
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
  }

  activateRow(territory: string) {
    this.store
      .select(reportsSelectors.filter)
      .pipe(take(1))
      .subscribe((filter: IReportsFilter) => {
        let activeMapPolygon = null;
        if (filter.activeMapPolygon !== territory) {
          activeMapPolygon = territory;
        }

        this.emitFilter({ activeMapPolygon }, false);
      });
  }

  savePDF(PDFRef: PDFExportComponent) {
    combineLatest([this.reportType$, this.locationName$])
      .pipe(take(1))
      .subscribe(([reportType, locationName]) => {
        let fileName = `${ReportsLabel[reportType]}${locationName} `;

        this.downloadService.savePDF(PDFRef, fileName);
      });
  }

  clickOutside() {
    this.emitFilter({ activeMapPolygon: null }, false);
  }

  emitFilter(filter: Partial<IReportsFilter>, fetch) {
    this.store.dispatch(
      reportsActions.updateReportFilter({
        payload: {
          filter,
        },
      })
    );

    if (fetch) {
      this.loadReport();
    }
  }

  loadReport() {
    this.reportType$.pipe(take(1)).subscribe(reportType => {
      this.store.dispatch(
        reportsActions.data.getDashboardReport({
          payload: {
            reportType,
          },
        })
      );
    });
  }

  onExpandBlock(block: ReportDashboardBlocks) {
    return () => {
      this.expandedBlock$.next(block);
      this.topElement.nativeElement.scrollIntoView(SCROLL_UP_CONFIG);
      this.tableTopElement.nativeElement.scrollIntoView(SCROLL_UP_CONFIG);
      this.cdRef.detectChanges();
    };
  }

  runReport({
    reportType,
    mode = null,
    range = null,
    value = null,
    scale = null,
    context,
    extras = null,
  }) {
    return () =>
      combineLatest([
        this.selectedMarket$,
        this.filter$,
        this.isMarketDashboard$,
      ])
        .pipe(take(1))
        .subscribe(
          ([market, filter, isMarketDashboard]: [
            Market[],
            IReportsFilter,
            boolean,
          ]) => {
            const param: ReportOptions = {
              reportType,
              metros: market.filter(x => !x.metro.includes(INACTIVE_FLAG)),
              mode,
              range,
              value,
              scale,
              context,
              extras,
              extraFilters: [],
            };

            if (
              filter.classification ||
              filter.housingType ||
              filter.propertyAge
            ) {
              let newFilter = {
                housingType: {
                  operation: LogicOperationValue.DEFAULT,
                  options: [],
                },
                classification: [],
                statsForm: {
                  yearBuilt: new YearGroupForm(),
                },
              };

              if (filter?.housingType) {
                newFilter.housingType.options = filter.housingType.map(x => ({
                  id: PropertyTypeEnum.Type,
                  value: x,
                  state: true,
                  isSelected: true,
                  tripleState: 1,
                  elasticValue: x,
                }));
                newFilter.housingType.operation = LogicOperationValue.OR;
              }

              if (filter?.classification) {
                newFilter.classification = filter.classification.map(x => ({
                  id: HOUSING_CLASSIFICATION_TYPE_ITEMS_ID,
                  value: x,
                  state: true,
                  isSelected: true,
                  tripleState: 1,
                  elasticValue: x,
                }));
              }

              if (filter?.yearBuilt?.length) {
                param.extraFilters.push({
                  filterType: FilterType.PropertyAge,
                  body: {
                    fiveOrLessYears: filter.yearBuilt.includes(
                      YearBuiltReportTitle.fiveOrLess
                    ),
                    sixToTenYears: filter.yearBuilt.includes(
                      YearBuiltReportTitle.sixToTen
                    ),
                    elevenToTwentyYears: filter.yearBuilt.includes(
                      YearBuiltReportTitle.elevenToTwenty
                    ),
                    twentyOneOrMoreYears: filter.yearBuilt.includes(
                      YearBuiltReportTitle.twentyOnePlus
                    ),
                  },
                });
              }

              param.extraFilters.push({
                filterType: FilterType.PropertyBuildingType,
                body: newFilter,
              });

              param.extraFilters.push({
                filterType: FilterType.PipelineBuildingType,
                body: {
                  housingType: newFilter.housingType,
                },
              });
            }

            param.extraFilters.push({
              filterType: FilterType.IncludeNewConstruction,
              body: {
                includeNewConstruction:
                  filter.includeNewConstruction ===
                  ReportToggleStatusFilterType.include,
              },
            });

            if (
              isMarketDashboard &&
              reportType !== ReportsElasticValue.NEW_IN_TOWN
            ) {
              param.submarkets = filter.activeTerritories.join(',');
            }

            if (
              !isEqual(filter.addressSearch, new AddressForm()) &&
              isMarketDashboard
            ) {
              param.extraFilters = [
                {
                  filterType: FilterType.Location,
                  body: { addressForm: filter.addressSearch },
                },
              ];
              param.metros = [];
              param.submarkets = '';
            }
            this.linkReportHelperService.onRunReport(param);
          }
        );
  }
}