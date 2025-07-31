import { Component, OnInit, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ChartComponent, ApexAxisChartSeries, ApexChart, ApexXAxis, ApexTitleSubtitle } from 'ng-apexcharts';
import { AlpacaDataService } from '../alpaca-data.service';
import { expectedDataFormat } from '../model';
import { SubscriptionMixin, Memoize } from './performance-utils';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { BehaviorSubject, EMPTY } from 'rxjs';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  title: ApexTitleSubtitle;
};

interface FormData {
  symbol: string;
  timeframe: string;
  limit: string;
  start: string;
  end: string;
  currency: string;
  asof: string;
  page_token: string;
  feed: string;
  adjustment: string;
}

@Component({
  selector: 'app-optimized-root',
  templateUrl: './optimized-app.component.html',
  styleUrls: ['./optimized-app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OptimizedAppComponent extends SubscriptionMixin implements OnInit, OnDestroy {
  @ViewChild('chart') chart!: ChartComponent;
  
  public chartOptions!: Partial<ChartOptions>;
  
  // Use reactive forms instead of template-driven forms
  private formDataSubject = new BehaviorSubject<FormData>({
    symbol: 'AAPL',
    timeframe: '1Week',
    limit: '',
    start: '',
    end: '',
    currency: '',
    asof: '',
    page_token: '',
    feed: '',
    adjustment: '',
  });

  formData$ = this.formDataSubject.asObservable();
  
  chartData: any[] = [];
  error = '';
  result: any;
  filter = '';
  loading = false;

  // Performance optimized observables
  private readonly searchSubject = new BehaviorSubject<FormData>(this.formDataSubject.value);
  
  readonly debouncedSearch$ = this.searchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(formData => this.submitData(formData)),
    catchError(() => EMPTY),
    this.takeUntilDestroy()
  );

  constructor(
    private dataService: AlpacaDataService,
    private cdRef: ChangeDetectorRef
  ) {
    super();
  }

  ngOnInit(): void {
    // Subscribe to debounced search
    this.debouncedSearch$.subscribe(
      (data) => this.handleDataResponse(data),
      (error) => this.handleError(error)
    );
  }

  @Memoize(5000) // Cache form data processing for 5 seconds
  private submitData(formData: FormData) {
    this.loading = true;
    this.error = '';
    this.cdRef.markForCheck();
    
    return this.dataService.getBarsV2Data(formData);
  }

  updateFormData(updates: Partial<FormData>): void {
    const currentData = this.formDataSubject.value;
    const newData = { ...currentData, ...updates };
    this.formDataSubject.next(newData);
    this.searchSubject.next(newData);
  }

  private handleDataResponse(data: any): void {
    this.loading = false;
    this.result = expectedDataFormat;
    
    if (!this.result.bars) {
      this.error = 'No Data is returned!!';
      this.cdRef.markForCheck();
      return;
    }

    this.generateChartData();
    this.cdRef.markForCheck();
  }

  private handleError(error: any): void {
    this.loading = false;
    this.error = error.error?.message || 'An error occurred';
    this.cdRef.markForCheck();
  }

  @Memoize(3000) // Cache chart generation
  private generateChartData(): void {
    let chartData = this.result.bars.map((x: any) => x.o);
    let barName = 'Open Price';
    
    if (this.filter) {
      chartData = this.result.bars.map((x: any) => x[this.filter]);
      barName = this.getBarName(this.filter);
    }

    this.chartOptions = {
      series: [
        {
          name: barName,
          data: chartData,
        },
      ],
      chart: {
        height: 350,
        type: 'bar',
        animations: {
          enabled: false // Disable animations for better performance
        },
        toolbar: {
          show: false // Hide toolbar for cleaner UI
        }
      },
      title: {
        text: 'Filtered by ' + barName,
      },
      xaxis: {
        categories: this.result.bars.map((x: any) => x.t),
        labels: {
          maxHeight: 80
        }
      },
    };
  }

  private getBarName(filter: string): string {
    const filterMap: { [key: string]: string } = {
      'o': 'Open Price',
      'h': 'High Price',
      'l': 'Low Price',
      'c': 'Close Price',
      'v': 'Volume',
      'n': 'Trade Count',
      'vw': 'VWAP'
    };
    
    return filterMap[filter] || 'Open Price';
  }

  submit(): void {
    const currentData = this.formDataSubject.value;
    this.searchSubject.next(currentData);
  }

  nextPage(): void {
    if (this.result?.next_page_token) {
      this.updateFormData({ page_token: this.result.next_page_token });
    }
  }

  // Track by functions for ngFor optimization
  trackByIndex(index: number): number {
    return index;
  }

  trackBySymbol(index: number, item: any): string {
    return item.symbol || index;
  }

  // Lazy load chart component
  async loadChartComponent(): Promise<any> {
    const { NgApexchartsModule } = await import('ng-apexcharts');
    return NgApexchartsModule;
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}