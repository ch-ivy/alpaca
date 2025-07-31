import { Component, OnInit, OnDestroy } from '@angular/core';
import { ScrollSpyService } from './scroll-spy.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-scroll-spy-example',
  template: `
    <div class="scroll-spy-container">
      <!-- Navigation -->
      <nav class="navbar">
        <ul class="nav-list">
          <li><a href="#section1" [class.active]="activeSection === 'section1'">Section 1</a></li>
          <li><a href="#section2" [class.active]="activeSection === 'section2'">Section 2</a></li>
          <li><a href="#section3" [class.active]="activeSection === 'section3'">Section 3</a></li>
          <li><a href="#section4" [class.active]="activeSection === 'section4'">Section 4</a></li>
        </ul>
      </nav>

      <!-- Sections -->
      <main class="content">
        <section id="section1" class="section" [class.active]="activeSection === 'section1'">
          <h2>Section 1</h2>
          <p>This is the first section. When multiple sections are visible, the scroll spy will now correctly prioritize the topmost section in the upper half of the viewport.</p>
          <div style="height: 400px; background: linear-gradient(to bottom, #ff9a9e, #fecfef);"></div>
        </section>

        <section id="section2" class="section" [class.active]="activeSection === 'section2'">
          <h2>Section 2</h2>
          <p>This is the second section. The fixed algorithm considers multiple factors to determine which section should be active.</p>
          <div style="height: 400px; background: linear-gradient(to bottom, #a8edea, #fed6e3);"></div>
        </section>

        <section id="section3" class="section" [class.active]="activeSection === 'section3'">
          <h2>Section 3</h2>
          <p>This is the third section. No more incorrect bottom section activation!</p>
          <div style="height: 400px; background: linear-gradient(to bottom, #d299c2, #fef9d7);"></div>
        </section>

        <section id="section4" class="section" [class.active]="activeSection === 'section4'">
          <h2>Section 4</h2>
          <p>This is the fourth section. The scroll spy now works reliably across all scenarios.</p>
          <div style="height: 400px; background: linear-gradient(to bottom, #89f7fe, #66a6ff);"></div>
        </section>
      </main>
    </div>
  `,
  styles: [`
    .scroll-spy-container {
      position: relative;
    }

    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 1000;
      padding: 1rem;
    }

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      gap: 1rem;
    }

    .nav-list a {
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      color: #666;
      transition: all 0.3s ease;
    }

    .nav-list a.active {
      background: #007bff;
      color: white;
    }

    .content {
      margin-top: 80px; /* Account for fixed navbar */
    }

    .section {
      padding: 2rem;
      margin-bottom: 2rem;
      border-radius: 8px;
      border: 2px solid transparent;
      transition: border-color 0.3s ease;
    }

    .section.active {
      border-color: #007bff;
      box-shadow: 0 0 20px rgba(0, 123, 255, 0.3);
    }

    .section h2 {
      margin-top: 0;
      color: #333;
    }
  `]
})
export class ScrollSpyExampleComponent implements OnInit, OnDestroy {
  activeSection: string | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private scrollSpyService: ScrollSpyService) {}

  ngOnInit() {
    // Initialize the scroll spy service
    this.scrollSpyService.init('.section');

    // Subscribe to active section changes
    this.subscription.add(
      this.scrollSpyService.getActiveSection().subscribe(activeElement => {
        this.activeSection = activeElement?.id || null;
      })
    );

    // Trigger initial update
    setTimeout(() => {
      this.scrollSpyService.updateNow('.section');
    }, 100);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.scrollSpyService.destroy();
  }
}