import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

interface SectionCandidate {
  section: Element;
  intersectionRatio: number;
  distanceFromTop: number;
  visibleHeight: number;
  isInUpperHalf: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ScrollSpyService {
  private activeSection$ = new Subject<Element | null>();
  private scrollSubject = new Subject<void>();

  constructor(private ngZone: NgZone) {
    // Throttle scroll events for better performance
    this.scrollSubject.pipe(
      throttleTime(16) // ~60fps
    ).subscribe(() => {
      this.updateActiveSection();
    });
  }

  /**
   * Initialize scroll spy for given sections
   * @param sectionSelector CSS selector for sections to track
   */
  init(sectionSelector: string = '.section'): void {
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', () => {
        this.scrollSubject.next();
      });
    });
  }

  /**
   * Get observable for active section changes
   */
  getActiveSection() {
    return this.activeSection$.asObservable();
  }

  /**
   * Fixed implementation that properly handles multiple visible sections
   * by prioritizing the most appropriate section to be marked as active
   */
  private getActiveSectionRobust(sections: NodeListOf<Element>): Element | null {
    const candidates: SectionCandidate[] = [];
    
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      
      // Check if the section is partially visible
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      
      if (isVisible) {
        // Calculate metrics for determining the best active section
        const visibleTop = Math.max(rect.top, 0);
        const visibleBottom = Math.min(rect.bottom, window.innerHeight);
        const visibleHeight = visibleBottom - visibleTop;
        const intersectionRatio = visibleHeight / rect.height;
        const distanceFromTop = Math.abs(rect.top);
        
        candidates.push({
          section,
          intersectionRatio,
          distanceFromTop,
          visibleHeight,
          isInUpperHalf: rect.top < window.innerHeight * 0.5
        });
      }
    });

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0].section;

    // Sort by priority to fix the issue where bottom section was being selected:
    // 1. Prefer sections in upper half of viewport (this fixes the main issue)
    // 2. Higher intersection ratio (more visible content)
    // 3. Closer to top (when other factors are equal)
    candidates.sort((a, b) => {
      // Priority 1: Prefer sections in upper half of viewport
      // This is the key fix for the reported issue
      if (a.isInUpperHalf !== b.isInUpperHalf) {
        return b.isInUpperHalf ? 1 : -1;
      }
      
      // Priority 2: Higher intersection ratio (more of the section is visible)
      if (Math.abs(a.intersectionRatio - b.intersectionRatio) > 0.1) {
        return b.intersectionRatio - a.intersectionRatio;
      }
      
      // Priority 3: Closer to top of viewport
      return a.distanceFromTop - b.distanceFromTop;
    });

    return candidates[0].section;
  }

  /**
   * Alternative simpler approach: Always prefer the topmost visible section
   */
  private getTopmostVisibleSection(sections: NodeListOf<Element>): Element | null {
    let topmostSection: Element | null = null;
    let minTopDistance = Infinity;

    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      
      // Check if the section is partially visible
      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      
      if (isVisible) {
        const topDistance = Math.abs(rect.top);
        
        // Only consider sections that are significantly in view
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        const minVisibleThreshold = Math.min(100, rect.height * 0.1); // At least 10% or 100px
        
        if (visibleHeight >= minVisibleThreshold && topDistance < minTopDistance) {
          minTopDistance = topDistance;
          topmostSection = section;
        }
      }
    });

    return topmostSection;
  }

  /**
   * Update active section and emit changes
   */
  private updateActiveSection(sectionSelector: string = '.section'): void {
    const sections = document.querySelectorAll(sectionSelector);
    
    // Use the robust method by default, but you can switch to getTopmostVisibleSection
    // if you always want the topmost section to be active
    const activeSection = this.getActiveSectionRobust(sections);
    
    this.ngZone.run(() => {
      this.activeSection$.next(activeSection);
    });

    // Update DOM classes
    this.updateSectionClasses(sections, activeSection);
  }

  /**
   * Update CSS classes for sections and navigation
   */
  private updateSectionClasses(sections: NodeListOf<Element>, activeSection: Element | null): void {
    // Remove active class from all sections
    sections.forEach(section => {
      section.classList.remove('active');
      // Also remove from navigation items if you have them
      const navItem = document.querySelector(`[href="#${section.id}"]`);
      if (navItem) {
        navItem.classList.remove('active');
      }
    });
    
    // Add active class to the selected section
    if (activeSection) {
      activeSection.classList.add('active');
      const navItem = document.querySelector(`[href="#${activeSection.id}"]`);
      if (navItem) {
        navItem.classList.add('active');
      }
    }
  }

  /**
   * Manually trigger active section update
   */
  updateNow(sectionSelector: string = '.section'): void {
    this.updateActiveSection(sectionSelector);
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.scrollSubject.complete();
    this.activeSection$.complete();
  }
}