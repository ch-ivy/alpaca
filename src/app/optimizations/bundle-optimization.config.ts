import { NgModule } from '@angular/core';
import { Route } from '@angular/router';

// Lazy Loading Route Configuration
export const OPTIMIZED_ROUTES: Route[] = [
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule),
    data: { preload: true }
  },
  {
    path: 'reports',
    loadChildren: () => import('./reports/reports.module').then(m => m.ReportsModule),
    data: { preload: false }
  },
  {
    path: 'analytics',
    loadChildren: () => import('./analytics/analytics.module').then(m => m.AnalyticsModule),
    data: { preload: false }
  },
  {
    path: 'charts',
    loadChildren: () => import('./charts/charts.module').then(m => m.ChartsModule),
    data: { preload: false }
  }
];

// Dynamic Import Strategy for Heavy Components
export class DynamicComponentLoader {
  static async loadApexCharts() {
    const { NgApexchartsModule } = await import('ng-apexcharts');
    return NgApexchartsModule;
  }

  static async loadKendoCharts() {
    const { ChartsModule } = await import('@progress/kendo-angular-charts');
    return ChartsModule;
  }

  static async loadDataGrid() {
    const { GridModule } = await import('@progress/kendo-angular-grid');
    return GridModule;
  }

  static async loadPdfExport() {
    const { PDFExportModule } = await import('@progress/kendo-angular-pdf-export');
    return PDFExportModule;
  }
}

// Webpack Bundle Optimization Configuration
export const WEBPACK_OPTIMIZATIONS = {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 10
      },
      angular: {
        test: /[\\/]node_modules[\\/]@angular[\\/]/,
        name: 'angular',
        chunks: 'all',
        priority: 20
      },
      kendo: {
        test: /[\\/]node_modules[\\/]@progress[\\/]/,
        name: 'kendo',
        chunks: 'all',
        priority: 15
      },
      charts: {
        test: /[\\/]node_modules[\\/](apexcharts|ng-apexcharts)[\\/]/,
        name: 'charts',
        chunks: 'all',
        priority: 15
      },
      common: {
        name: 'common',
        minChunks: 2,
        chunks: 'all',
        priority: 5,
        reuseExistingChunk: true
      }
    }
  }
};

// Tree Shaking Configuration
export const TREE_SHAKING_CONFIG = {
  // Import only specific RxJS operators
  rxjsOperators: [
    'map',
    'filter',
    'take',
    'takeUntil',
    'distinctUntilChanged',
    'shareReplay',
    'debounceTime',
    'combineLatest',
    'withLatestFrom',
    'switchMap',
    'mergeMap',
    'catchError',
    'retry',
    'finalize'
  ],
  
  // Lodash ES imports
  lodashFunctions: [
    'isEqual',
    'debounce',
    'throttle',
    'memoize',
    'cloneDeep',
    'sortBy',
    'groupBy',
    'uniqBy'
  ],

  // Angular Material components to include
  materialComponents: [
    'MatIconModule',
    'MatButtonModule',
    'MatTooltipModule',
    'MatDialogModule',
    'MatMenuModule',
    'MatSelectModule',
    'MatInputModule',
    'MatFormFieldModule'
  ]
};

// Code Splitting Strategy
export class CodeSplittingStrategy {
  // Lazy load heavy chart libraries
  static async loadChartLibrary(chartType: 'apex' | 'kendo' | 'd3'): Promise<any> {
    switch (chartType) {
      case 'apex':
        return await import('apexcharts');
      case 'kendo':
        return await import('@progress/kendo-angular-charts');
      case 'd3':
        return await import('d3');
      default:
        throw new Error('Unknown chart type');
    }
  }

  // Lazy load large data processing utilities
  static async loadDataUtils(): Promise<any> {
    return await import('./data-processing.utils');
  }

  // Lazy load PDF generation
  static async loadPdfGenerator(): Promise<any> {
    return await import('./pdf-generator.service');
  }
}

// Performance Budgets
export const PERFORMANCE_BUDGETS = {
  initial: {
    maximumWarning: '1mb',
    maximumError: '2mb'
  },
  anyComponentStyle: {
    maximumWarning: '2kb',
    maximumError: '5kb'
  },
  bundle: {
    maximumWarning: '500kb',
    maximumError: '1mb'
  }
};

// Asset Optimization Configuration
export const ASSET_OPTIMIZATION = {
  images: {
    formats: ['webp', 'avif', 'jpg', 'png'],
    compressionLevel: 85,
    responsiveSizes: [320, 640, 768, 1024, 1920],
    lazyLoadingThreshold: '200px'
  },
  fonts: {
    display: 'swap',
    preload: ['woff2'],
    subsets: ['latin', 'latin-ext']
  },
  icons: {
    format: 'svg',
    sprite: true,
    optimization: true
  }
};

// Service Worker Configuration for Caching
export const SERVICE_WORKER_CONFIG = {
  scope: './',
  navigationUrls: [
    '/**',
    '!/**/*.*',
    '!/**/*__*',
    '!/**/*__*/**'
  ],
  resources: {
    files: [
      '/favicon.ico',
      '/index.html',
      '/*.css',
      '/*.js'
    ],
    urls: [
      'https://fonts.googleapis.com/**',
      'https://api.example.com/static/**'
    ]
  },
  dataGroups: [
    {
      name: 'api-cache',
      urls: ['/api/**'],
      cacheConfig: {
        strategy: 'freshness',
        maxSize: 100,
        maxAge: '1h',
        timeout: '10s'
      }
    }
  ]
};

// Preloading Strategy
export class OptimizedPreloadingStrategy {
  static shouldPreload(route: Route): boolean {
    return route.data && route.data['preload'] === true;
  }

  static getPreloadDelay(route: Route): number {
    // Delay preloading based on route priority
    return route.data && route.data['priority'] === 'high' ? 0 : 2000;
  }
}

// Module Federation Configuration (for micro-frontends)
export const MODULE_FEDERATION_CONFIG = {
  name: 'dashboard',
  exposes: {
    './DashboardComponent': './src/app/dashboard/dashboard.component.ts',
    './ReportsModule': './src/app/reports/reports.module.ts'
  },
  shared: {
    '@angular/core': { singleton: true, strictVersion: true },
    '@angular/common': { singleton: true, strictVersion: true },
    '@angular/router': { singleton: true, strictVersion: true },
    'rxjs': { singleton: true, strictVersion: true }
  }
};

// Critical CSS Extraction
export const CRITICAL_CSS_CONFIG = {
  base: './dist/',
  src: 'index.html',
  css: ['styles.css'],
  dimensions: [
    { width: 1920, height: 1080 },
    { width: 768, height: 1024 },
    { width: 375, height: 667 }
  ],
  penthouse: {
    timeout: 30000,
    forceInclude: [
      '.skeleton-loader',
      '.dashboard-container',
      '.loading'
    ]
  }
};

// Bundle Analysis Configuration
export const BUNDLE_ANALYSIS_CONFIG = {
  analyzerMode: 'server',
  analyzerPort: 8888,
  reportFilename: 'bundle-report.html',
  openAnalyzer: true,
  generateStatsFile: true,
  statsFilename: 'stats.json',
  logLevel: 'info'
};

@NgModule({})
export class BundleOptimizationModule {
  static forRoot() {
    return {
      ngModule: BundleOptimizationModule,
      providers: [
        // Add optimization providers here
      ]
    };
  }
}