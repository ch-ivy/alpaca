import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

// Chart modules - lazy loaded
const ChartModules = () => import('@progress/kendo-angular-charts').then(m => m.ChartsModule);
const PDFExportModule = () => import('@progress/kendo-angular-pdf-export').then(m => m.PDFExportModule);

// Dashboard components
import { DashboardReportOptimizedComponent } from './components/dashboard-report-optimized.component';
import { DashboardReportMapHelperService } from './services/dashboard-report-map-helper.service';

// Shared modules
import { SharedModule } from '@shared/shared.module';

const routes: Routes = [
  {
    path: '',
    component: DashboardReportOptimizedComponent,
    data: { preload: true }
  }
];

@NgModule({
  declarations: [
    DashboardReportOptimizedComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    SharedModule
  ],
  providers: [
    DashboardReportMapHelperService
  ]
})
export class DashboardModule {
  // Lazy load chart modules when needed
  static async loadChartModules() {
    const [chartsModule, pdfModule] = await Promise.all([
      ChartModules(),
      PDFExportModule()
    ]);
    return { chartsModule, pdfModule };
  }
}