const path = require('path');
const webpack = require('webpack');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = (config, options) => {
  // Enable tree shaking for better bundle optimization
  config.optimization = {
    ...config.optimization,
    usedExports: true,
    sideEffects: false,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true,
          enforce: true
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 5,
          reuseExistingChunk: true,
          enforce: true
        },
        charts: {
          test: /[\\/]node_modules[\\/](apexcharts|ng-apexcharts|@progress\/kendo-angular-charts)[\\/]/,
          name: 'charts',
          chunks: 'all',
          priority: 15
        },
        kendo: {
          test: /[\\/]node_modules[\\/]@progress[\\/]kendo-angular/,
          name: 'kendo',
          chunks: 'all',
          priority: 12
        }
      }
    }
  };

  // Add compression for production builds
  if (options.configuration === 'production') {
    config.plugins.push(
      new CompressionPlugin({
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8
      })
    );

    // Enable bundle analyzer in production for optimization insights
    if (process.env['ANALYZE']) {
      config.plugins.push(new BundleAnalyzerPlugin());
    }
  }

  // Optimize module resolution
  config.resolve = {
    ...config.resolve,
    alias: {
      '@shared': path.resolve(__dirname, 'src/app/shared'),
      '@store': path.resolve(__dirname, 'src/app/store'),
      '@configs': path.resolve(__dirname, 'src/app/configs')
    }
  };

  // Add performance hints
  config.performance = {
    hints: 'warning',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  };

  return config;
};