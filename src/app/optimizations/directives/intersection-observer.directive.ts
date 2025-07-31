import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  NgZone,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appIntersectionObserver]'
})
export class IntersectionObserverDirective implements OnInit, OnDestroy {
  @Input() threshold = 0.1;
  @Input() rootMargin = '0px';
  @Input() root: Element | null = null;

  @Output() onIntersection = new EventEmitter<IntersectionObserverEntry>();
  @Output() onEnter = new EventEmitter<IntersectionObserverEntry>();
  @Output() onLeave = new EventEmitter<IntersectionObserverEntry>();

  private observer?: IntersectionObserver;
  private hasIntersected = false;

  constructor(
    private element: ElementRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.createObserver();
    });
  }

  ngOnDestroy(): void {
    this.destroyObserver();
  }

  private createObserver(): void {
    if (!('IntersectionObserver' in window)) {
      // Fallback for browsers without IntersectionObserver support
      this.ngZone.run(() => {
        this.onIntersection.emit({
          isIntersecting: true,
          target: this.element.nativeElement
        } as IntersectionObserverEntry);
      });
      return;
    }

    const options: IntersectionObserverInit = {
      threshold: this.threshold,
      rootMargin: this.rootMargin,
      root: this.root
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        this.ngZone.run(() => {
          this.onIntersection.emit(entry);
          
          if (entry.isIntersecting) {
            this.onEnter.emit(entry);
            this.hasIntersected = true;
          } else if (this.hasIntersected) {
            this.onLeave.emit(entry);
          }
        });
      });
    }, options);

    this.observer.observe(this.element.nativeElement);
  }

  private destroyObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  public forceCheck(): void {
    if (!this.observer) {
      return;
    }

    // Manually trigger intersection check
    this.observer.unobserve(this.element.nativeElement);
    this.observer.observe(this.element.nativeElement);
  }
}

// Lazy Loading Image Directive
@Directive({
  selector: '[appLazyImage]'
})
export class LazyImageDirective implements OnInit, OnDestroy {
  @Input() appLazyImage!: string;
  @Input() placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+PC9zdmc+';
  @Input() errorImage = '/assets/images/error-image.png';

  private observer?: IntersectionObserver;
  private isLoaded = false;

  constructor(
    private element: ElementRef<HTMLImageElement>,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Set placeholder image initially
    this.element.nativeElement.src = this.placeholder;
    this.element.nativeElement.classList.add('lazy-loading');

    this.ngZone.runOutsideAngular(() => {
      this.createObserver();
    });
  }

  ngOnDestroy(): void {
    this.destroyObserver();
  }

  private createObserver(): void {
    if (!('IntersectionObserver' in window)) {
      this.loadImage();
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isLoaded) {
          this.loadImage();
          this.observer?.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '50px'
    });

    this.observer.observe(this.element.nativeElement);
  }

  private loadImage(): void {
    if (this.isLoaded) {
      return;
    }

    const img = new Image();
    
    img.onload = () => {
      this.ngZone.run(() => {
        this.element.nativeElement.src = this.appLazyImage;
        this.element.nativeElement.classList.remove('lazy-loading');
        this.element.nativeElement.classList.add('lazy-loaded');
        this.isLoaded = true;
      });
    };

    img.onerror = () => {
      this.ngZone.run(() => {
        this.element.nativeElement.src = this.errorImage;
        this.element.nativeElement.classList.remove('lazy-loading');
        this.element.nativeElement.classList.add('lazy-error');
      });
    };

    img.src = this.appLazyImage;
  }

  private destroyObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }
}

// Lazy Loading Component Directive
@Directive({
  selector: '[appLazyComponent]'
})
export class LazyComponentDirective implements OnInit, OnDestroy {
  @Input() appLazyComponent!: () => Promise<any>;
  @Input() threshold = 0.1;
  @Input() once = true;

  @Output() componentLoaded = new EventEmitter<any>();
  @Output() loadingError = new EventEmitter<Error>();

  private observer?: IntersectionObserver;
  private hasLoaded = false;

  constructor(
    private element: ElementRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.createObserver();
    });
  }

  ngOnDestroy(): void {
    this.destroyObserver();
  }

  private createObserver(): void {
    if (!('IntersectionObserver' in window)) {
      this.loadComponent();
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && (!this.hasLoaded || !this.once)) {
          this.loadComponent();
          
          if (this.once) {
            this.observer?.unobserve(entry.target);
          }
        }
      });
    }, {
      threshold: this.threshold,
      rootMargin: '100px'
    });

    this.observer.observe(this.element.nativeElement);
  }

  private async loadComponent(): Promise<void> {
    if (this.hasLoaded && this.once) {
      return;
    }

    try {
      this.element.nativeElement.classList.add('component-loading');
      
      const component = await this.appLazyComponent();
      
      this.ngZone.run(() => {
        this.componentLoaded.emit(component);
        this.element.nativeElement.classList.remove('component-loading');
        this.element.nativeElement.classList.add('component-loaded');
        this.hasLoaded = true;
      });
    } catch (error) {
      this.ngZone.run(() => {
        this.loadingError.emit(error as Error);
        this.element.nativeElement.classList.remove('component-loading');
        this.element.nativeElement.classList.add('component-error');
      });
    }
  }

  private destroyObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }
}

// Viewport Visibility Directive
@Directive({
  selector: '[appViewportVisibility]'
})
export class ViewportVisibilityDirective implements OnInit, OnDestroy {
  @Input() threshold = 0.5;
  @Input() rootMargin = '0px';

  @Output() visibilityChange = new EventEmitter<{
    isVisible: boolean;
    intersectionRatio: number;
    entry: IntersectionObserverEntry;
  }>();

  private observer?: IntersectionObserver;

  constructor(
    private element: ElementRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.createObserver();
    });
  }

  ngOnDestroy(): void {
    this.destroyObserver();
  }

  private createObserver(): void {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        this.ngZone.run(() => {
          this.visibilityChange.emit({
            isVisible: entry.isIntersecting,
            intersectionRatio: entry.intersectionRatio,
            entry
          });
        });
      });
    }, {
      threshold: this.threshold,
      rootMargin: this.rootMargin
    });

    this.observer.observe(this.element.nativeElement);
  }

  private destroyObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }
}