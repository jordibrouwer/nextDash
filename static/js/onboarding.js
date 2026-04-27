class Onboarding {
    constructor(options = {}) {
        this.hasBookmarks = options.hasBookmarks === true;
        this.steps = this.buildSteps();
        this.currentStep = 0;
        this.overlay = null;
        this.highlightedElement = null;
        this.keyHandler = null;
        // Use v2 keys to avoid stale localStorage state blocking first-run onboarding.
        this.version = 2;
        this.storageSeenKey = 'nextDashOnboardingSeenV2';
        this.storageVersionKey = 'nextDashOnboardingVersionV2';
        this.serverCompleted = options.serverCompleted === true;
        this.onPersist = typeof options.onPersist === 'function' ? options.onPersist : null;
        this.persisted = false;
    }

    shouldStart() {
        if (this.serverCompleted) {
            return false;
        }
        return true;
    }

    maybeStart() {
        if (!this.shouldStart()) {
            return;
        }
        this.render();
        this.showStep(0);
    }

    buildSteps() {
        return [
            {
                title: 'Welcome to nextDash',
                body: 'Quick setup in 30 seconds. You can skip anytime.',
                selector: '.header-top',
                primaryLabel: 'Start quick tour'
            },
            {
                title: 'Tip rotation',
                body: 'Shortcut tips rotate above the buttons. You can hide them in config.',
                selector: '#button-hint-text',
                placement: 'top'
            },
            {
                title: 'Search & shortcuts',
                body: 'Use > for search, * for recent, and ! for cheatsheet.',
                selector: '#search-button',
                placement: 'top'
            },
            {
                title: 'Configuration',
                body: 'Open config to manage pages, smart collections, and layout.',
                selector: '.config-link a',
                secondaryAction: {
                    label: 'Open config',
                    handler: () => {
                        window.location.href = '/config#general';
                    }
                }
            },
            {
                title: this.hasBookmarks ? 'You are ready' : 'Add your first bookmark',
                body: this.hasBookmarks
                    ? 'Try search now and open any bookmark with Enter.'
                    : 'Open config and add a bookmark or import CSV to get started.',
                selector: this.hasBookmarks ? '#search-button' : '.config-link a',
                primaryLabel: 'Finish'
            }
        ];
    }

    render() {
        if (this.overlay) {
            return;
        }
        const overlay = document.createElement('div');
        overlay.className = 'onboarding-overlay';
        overlay.innerHTML = `
            <div class="onboarding-card" role="dialog" aria-modal="true" aria-live="polite">
                <div class="onboarding-progress"></div>
                <h3 class="onboarding-title"></h3>
                <p class="onboarding-body"></p>
                <div class="onboarding-actions">
                    <button type="button" class="onboarding-btn onboarding-back">Back</button>
                    <button type="button" class="onboarding-btn onboarding-skip">Skip</button>
                    <button type="button" class="onboarding-btn onboarding-secondary" hidden></button>
                    <button type="button" class="onboarding-btn onboarding-next">Next</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.overlay = overlay;

        overlay.querySelector('.onboarding-back').addEventListener('click', () => this.prevStep());
        overlay.querySelector('.onboarding-skip').addEventListener('click', () => this.finish());
        overlay.querySelector('.onboarding-next').addEventListener('click', () => this.nextStep());

        this.keyHandler = (e) => {
            if (e.key === 'Escape') {
                this.finish();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    showStep(index) {
        this.currentStep = Math.max(0, Math.min(index, this.steps.length - 1));
        const step = this.steps[this.currentStep];
        if (!this.overlay || !step) {
            return;
        }

        const title = this.overlay.querySelector('.onboarding-title');
        const body = this.overlay.querySelector('.onboarding-body');
        const progress = this.overlay.querySelector('.onboarding-progress');
        const back = this.overlay.querySelector('.onboarding-back');
        const next = this.overlay.querySelector('.onboarding-next');
        const secondary = this.overlay.querySelector('.onboarding-secondary');

        title.textContent = step.title;
        body.textContent = step.body;
        progress.textContent = `${this.currentStep + 1}/${this.steps.length}`;

        back.disabled = this.currentStep === 0;
        next.textContent = step.primaryLabel || (this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next');

        if (step.secondaryAction && typeof step.secondaryAction.handler === 'function') {
            secondary.hidden = false;
            secondary.textContent = step.secondaryAction.label || 'Open';
            secondary.onclick = step.secondaryAction.handler;
        } else {
            secondary.hidden = true;
            secondary.textContent = '';
            secondary.onclick = null;
        }

        this.positionCard(step);
        this.highlight(step.selector);
    }

    positionCard(step) {
        if (!this.overlay) return;
        const card = this.overlay.querySelector('.onboarding-card');
        if (!card) return;

        // Mobile keeps default bottom placement for stability.
        if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches) {
            this.overlay.classList.remove('onboarding-overlay-floating');
            card.style.removeProperty('top');
            card.style.removeProperty('left');
            return;
        }

        const target = step && step.selector ? document.querySelector(step.selector) : null;
        const placement = step && step.placement ? step.placement : 'bottom';
        if (!target || (placement !== 'top' && placement !== 'bottom')) {
            this.overlay.classList.remove('onboarding-overlay-floating');
            card.style.removeProperty('top');
            card.style.removeProperty('left');
            return;
        }

        this.overlay.classList.add('onboarding-overlay-floating');

        const viewportPadding = 16;
        const gap = 12;
        const rect = target.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        const maxLeft = Math.max(viewportPadding, window.innerWidth - cardRect.width - viewportPadding);
        const centeredLeft = rect.left + (rect.width / 2) - (cardRect.width / 2);
        const left = Math.min(maxLeft, Math.max(viewportPadding, centeredLeft));

        const desiredTop = placement === 'top'
            ? rect.top - cardRect.height - gap
            : rect.bottom + gap;
        const maxTop = Math.max(viewportPadding, window.innerHeight - cardRect.height - viewportPadding);
        const top = Math.min(maxTop, Math.max(viewportPadding, desiredTop));

        card.style.left = `${Math.round(left)}px`;
        card.style.top = `${Math.round(top)}px`;
    }

    highlight(selector) {
        if (this.highlightedElement) {
            this.highlightedElement.classList.remove('onboarding-highlight');
            this.highlightedElement = null;
        }
        if (!selector) {
            return;
        }
        const element = document.querySelector(selector);
        if (!element) {
            return;
        }
        element.classList.add('onboarding-highlight');
        this.highlightedElement = element;
        const computedStyle = window.getComputedStyle ? window.getComputedStyle(element) : null;
        const isFixedLike = computedStyle && (computedStyle.position === 'fixed' || computedStyle.position === 'sticky');
        if (!isFixedLike && typeof element.scrollIntoView === 'function') {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
    }

    nextStep() {
        if (this.currentStep >= this.steps.length - 1) {
            this.finish();
            return;
        }
        this.showStep(this.currentStep + 1);
    }

    prevStep() {
        this.showStep(this.currentStep - 1);
    }

    finish() {
        try {
            localStorage.setItem(this.storageSeenKey, 'true');
            localStorage.setItem(this.storageVersionKey, String(this.version));
        } catch (error) {
            // Ignore storage errors; onboarding can still close normally.
        }
        if (this.onPersist && !this.persisted) {
            this.persisted = true;
            Promise.resolve(this.onPersist()).catch(() => {});
        }
        if (this.highlightedElement) {
            this.highlightedElement.classList.remove('onboarding-highlight');
            this.highlightedElement = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    }
}

window.Onboarding = Onboarding;
