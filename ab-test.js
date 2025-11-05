
class ABTest {
    constructor() {
        this.variant = this.getVariant();
        this.trackingData = [];
    }

    getVariant() {
        let variant = localStorage.getItem('ab_variant');
        if (!variant) {
            variant = Math.random() < 0.5 ? 'A' : 'B';
            localStorage.setItem('ab_variant', variant);
        }
        return variant;
    }

    getRedirectDelay() {
        return this.variant === 'A' ? 1200 : 2000;
    }

    trackEvent(eventName, data = {}) {
        const event = {
            variant: this.variant,
            event: eventName,
            timestamp: Date.now(),
            ...data
        };
        this.trackingData.push(event);
        
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, {
                'ab_variant': this.variant,
                ...data
            });
        }
    }

    sendBeacon() {
        if (navigator.sendBeacon && this.trackingData.length > 0) {
            const blob = new Blob([JSON.stringify(this.trackingData)], 
                                  { type: 'application/json' });
            navigator.sendBeacon('/api/track.php', blob);
        }
    }
}
