/**
 * Config "Stats" tab: library counts, open activity, search/status snapshot.
 */
class ConfigStats {
    constructor(t) {
        this.t = typeof t === 'function' ? t : (k) => k;
    }

    yn(val) {
        return val ? this.t('config.statsYes') : this.t('config.statsNo');
    }

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        }
    }

    pageName(pages, pageId) {
        const id = Number(pageId);
        const p = pages.find((x) => Number(x.id) === id);
        return p && p.name ? String(p.name) : (Number.isFinite(id) ? `Page ${id}` : '');
    }

    formatWhen(ts, locale) {
        const n = Number(ts);
        if (!n) {
            return '—';
        }
        try {
            return new Date(n).toLocaleString(locale || undefined, {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        } catch (e) {
            return '—';
        }
    }

    clearTable(tbodyId) {
        const tb = document.getElementById(tbodyId);
        if (tb) {
            tb.textContent = '';
        }
    }

    appendRow(tbodyId, cells) {
        const tb = document.getElementById(tbodyId);
        if (!tb) {
            return;
        }
        const tr = document.createElement('tr');
        cells.forEach((text) => {
            const td = document.createElement('td');
            td.textContent = text;
            tr.appendChild(td);
        });
        tb.appendChild(tr);
    }

    refresh(manager) {
        const bookmarks = Array.isArray(manager.allBookmarksData) ? manager.allBookmarksData : [];
        const pages = Array.isArray(manager.pagesData) ? manager.pagesData : [];
        const settings = manager.settingsData || {};
        const locale = settings.language || undefined;

        const withUrl = bookmarks.filter((b) => String(b?.url || '').trim() !== '').length;
        const withShortcut = bookmarks.filter((b) => String(b?.shortcut || '').trim() !== '').length;
        const categoryKeys = new Set();
        bookmarks.forEach((b) => {
            const pid = Number(b.pageId) || 0;
            const cat = String(b.category || '').trim();
            categoryKeys.add(`${pid}::${cat}`);
        });

        const statusCheckCount = bookmarks.filter((b) => b?.checkStatus === true).length;
        const neverOpened = bookmarks.filter(
            (b) => Number(b?.openCount || 0) === 0 && !(Number(b?.lastOpened || 0) > 0)
        ).length;

        this.setText('stats-pages-count', String(pages.length));
        this.setText('stats-categories-count', String(categoryKeys.size));
        this.setText('stats-bookmarks-total', String(bookmarks.length));
        this.setText('stats-with-url', String(withUrl));
        this.setText('stats-without-url', String(Math.max(0, bookmarks.length - withUrl)));
        this.setText('stats-with-shortcut', String(withShortcut));
        this.setText('stats-without-shortcut', String(Math.max(0, bookmarks.length - withShortcut)));
        this.setText('stats-never-opened', String(neverOpened));

        const top = [...bookmarks]
            .filter((b) => Number(b?.openCount || 0) > 0)
            .sort((a, b) => Number(b.openCount || 0) - Number(a.openCount || 0))
            .slice(0, 10);

        this.clearTable('stats-top-opens-body');
        if (top.length === 0) {
            this.appendRow('stats-top-opens-body', [this.t('config.statsNoData'), '', '', '']);
        } else {
            top.forEach((b) => {
                this.appendRow('stats-top-opens-body', [
                    String(b.name || '—'),
                    String(Number(b.openCount || 0)),
                    this.pageName(pages, b.pageId),
                    this.formatWhen(b.lastOpened, locale)
                ]);
            });
        }

        const recent = [...bookmarks]
            .filter((b) => Number(b?.lastOpened || 0) > 0)
            .sort((a, b) => Number(b.lastOpened || 0) - Number(a.lastOpened || 0))
            .slice(0, 10);

        this.clearTable('stats-recent-opens-body');
        if (recent.length === 0) {
            this.appendRow('stats-recent-opens-body', [this.t('config.statsNoData'), '', '', '']);
        } else {
            recent.forEach((b) => {
                this.appendRow('stats-recent-opens-body', [
                    String(b.name || '—'),
                    String(Number(b.openCount || 0)),
                    this.pageName(pages, b.pageId),
                    this.formatWhen(b.lastOpened, locale)
                ]);
            });
        }

        const idxKnown = Object.prototype.hasOwnProperty.call(settings, 'searchIndexed');
        this.setText(
            'stats-search-indexed',
            idxKnown ? this.yn(Boolean(settings.searchIndexed)) : this.t('config.statsUnknown')
        );
        this.setText('stats-interleave', this.yn(Boolean(settings.interleaveMode)));
        this.setText('stats-fuzzy', this.yn(Boolean(settings.enableFuzzySuggestions)));
        this.setText('stats-show-status', this.yn(Boolean(settings.showStatus)));
        this.setText('stats-status-check-count', String(statusCheckCount));
    }
}

window.ConfigStats = ConfigStats;
