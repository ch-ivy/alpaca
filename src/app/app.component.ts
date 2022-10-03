import { Component, OnInit, ViewChild } from '@angular/core';
import {
  ChartComponent,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexTitleSubtitle,
} from 'ng-apexcharts';
import { AlpacaDataService } from './alpaca-data.service';
import { expectedDataFormat } from './model';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  title: ApexTitleSubtitle;
};
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  @ViewChild('chart') chart!: ChartComponent;
  public chartOptions!: Partial<ChartOptions>;

  chartData = [];
  formData = {
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
  };
  error!: string;
  result!: any;
  filter: string = '';

  constructor(private data: AlpacaDataService) {}

  ngOnInit(): void {}

  submit() {
    this.error = '';
    console.log(this.formData);

    this.data.getBarsV2Data(this.formData).subscribe(
      (data) => {
        console.log(data);
        this.result = expectedDataFormat;
        if (!this.result.bars) {
          this.error = 'No Data is returned!!';
          return;
        }
        let chart_data = this.result.bars.map((x: any) => x.o);
        let bar_name = 'Open Price';
        if (this.filter) {
          chart_data = this.result.bars.map((x: any) => x[this.filter]);
          switch (this.filter) {
            case 'o': {
              bar_name = 'Open Price';
              break;
            }
            case 'h': {
              bar_name = 'High Price';
              break;
            }
            case 'l': {
              bar_name = 'Low Price';
              break;
            }
            case 'C': {
              bar_name = 'Close Price';
              break;
            }
            case 'v': {
              bar_name = 'Volume';
              break;
            }
            case 'n': {
              bar_name = 'Trade Count';
              break;
            }
            case 'vw': {
              bar_name = 'VWAP';
              break;
            }
          }
        }
        this.chartOptions = {
          series: [
            {
              name: bar_name,
              data: chart_data,
            },
          ],
          chart: {
            height: 350,
            type: 'bar',
          },
          title: {
            text: 'Filtererd by ' + bar_name,
          },
          xaxis: {
            categories: this.result.bars.map((x: any) => x.t),
          },
        };
      },
      (err) => {
        console.error(err);
        this.error = err.error.message;
      }
    );
  }

  nextPage() {
    this.formData.page_token = this.result.next_page_token;
    this.submit();
  }
}
