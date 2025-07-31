import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { PerformanceService } from '../services/performance.service';

@Injectable()
export class PerformanceInterceptor implements HttpInterceptor {
  private pendingRequests = new Map<string, number>();

  constructor(private performanceService: PerformanceService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const requestId = this.generateRequestId(req);
    const startTime = performance.now();
    
    // Mark the start of the request
    this.performanceService.markStart(`api-${requestId}`);
    this.pendingRequests.set(requestId, startTime);

    // Add caching headers for report data
    let modifiedReq = req;
    if (this.isReportDataRequest(req)) {
      modifiedReq = req.clone({
        setHeaders: {
          'Cache-Control': 'max-age=300', // 5 minutes cache
          'Pragma': 'cache'
        }
      });
    }

    return next.handle(modifiedReq).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // Log slow requests
          if (duration > 2000) {
            console.warn(`Slow API request detected: ${req.url} took ${duration}ms`);
          }

          // Track response size for large payloads
          const responseSize = this.calculateResponseSize(event);
          if (responseSize > 1000000) { // 1MB
            console.warn(`Large response detected: ${req.url} - ${responseSize / 1000000}MB`);
          }
        }
      }),
      finalize(() => {
        this.performanceService.markEnd(`api-${requestId}`);
        this.pendingRequests.delete(requestId);
      })
    );
  }

  private generateRequestId(req: HttpRequest<any>): string {
    return `${req.method}-${req.url.split('?')[0]}`.replace(/[^a-zA-Z0-9]/g, '-');
  }

  private isReportDataRequest(req: HttpRequest<any>): boolean {
    return req.url.includes('/reports/') || req.url.includes('/dashboard/');
  }

  private calculateResponseSize(response: HttpResponse<any>): number {
    const body = response.body;
    if (typeof body === 'string') {
      return new Blob([body]).size;
    } else if (body) {
      return new Blob([JSON.stringify(body)]).size;
    }
    return 0;
  }

  // Get current pending requests count
  getPendingRequestsCount(): number {
    return this.pendingRequests.size;
  }

  // Get average request time
  getAverageRequestTime(): number {
    const now = performance.now();
    let totalTime = 0;
    let count = 0;

    this.pendingRequests.forEach(startTime => {
      totalTime += now - startTime;
      count++;
    });

    return count > 0 ? totalTime / count : 0;
  }
}