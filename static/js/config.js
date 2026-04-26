/**
 * Main Configuration Manager
 * Orchestrates all configuration modules
 */

class ConfigManager {
    constructor() {
        // Initialize modules
        this.storage = new ConfigStorage();
        this.data = new ConfigData(this.storage);
        this.ui = new ConfigUI();
        this.language = new ConfigLanguage();
        this.pages = new ConfigPages(this.language.t.bind(this.language));
        this.categories = new ConfigCategories(this.language.t.bind(this.language));
        this.bookmarks = new ConfigBookmarks(this.language.t.bind(this.language));
        window.configBookmarks = this.bookmarks;
        this.finders = new ConfigFinders(this.language.t.bind(this.language));
        this.backup = new ConfigBackup(this.language.t.bind(this.language));
        this.settings = new ConfigSettings(this.language);
        this.stats = null;

        // Data
        this.pagesData = [];
        this.originalPagesData = []; // Track original pages to detect deletions
        this.currentPageId = 1; // Default to page 1
        this.currentCategoriesPageId = 1; // Default to page 1 for categories
        this.bookmarksData = [];
        this.allBookmarksData = [];
        this.findersData = [];
        this.categoriesData = []; // Categories for the categories tab
        this.bookmarksPageCategories = []; // Categories for the bookmarks tab (read-only)
        this.currentBookmarksCategoryFilter = '__all__';
        this.settingsData = {
            currentPage: 'default',
            theme: 'cherry-graphite-dark',
            openInNewTab: true,
            columnsPerRow: 3,
            fontSize: 'm',
            showBackgroundDots: true,
            showTitle: true,
            showDate: true,
            showCheatSheetButton: true,
            showRecentButton: true,
            showTips: true,
            showSyncToasts: true,
            showStatus: false,
            showPing: false,
            skipFastPing: false,
            globalShortcuts: true,
            hyprMode: false,
            showPageNamesInTabs: false,
            enableCustomFavicon: false,
            customFaviconPath: '',
            enableCustomFont: false,
            customFontPath: '',
            language: 'en',
            interleaveMode: false,
            showPageTabs: true,
            enableFuzzySuggestions: false,
            fuzzySuggestionsStartWith: false,
            keepSearchOpenWhenEmpty: false,
            showIcons: false,
            sortMethod: 'order',
            layoutPreset: 'default',
            backgroundOpacity: 1,
            fontWeight: 'normal',
            autoDarkMode: false,
            showSmartRecentCollection: false,
            showSmartStaleCollection: false,
            showSmartMostUsedCollection: false,
            smartRecentLimit: 50,
            smartStaleLimit: 50,
            smartMostUsedLimit: 25,
            smartRecentPageIds: [],
            smartStalePageIds: [],
            smartMostUsedPageIds: []
        };
        this.deviceSpecific = false;
        this.isDirty = false;
        this.undoSnapshot = null;
        this.savedSnapshot = null;
        this.suppressDirtyTracking = false;
        this.structureSyncEventKey = 'nextdash:config-structure-sync';
        this.settingsSyncEventKey = 'nextdash:config-settings-sync';
        this.tabId = `cfg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        this.lastSyncToastAt = 0;

        this.init();
    }

    async init() {
        await this.loadData();
        await this.language.init(this.settingsData.language);
        if (typeof ConfigStats === 'function') {
            this.stats = new ConfigStats(this.language.t.bind(this.language));
        }
        this.setupDOM();
        await this.setupEventListeners();
        this.language.setupLanguageSelector();
        this.setupGeneralCardCollapsible();
        
        // Set language for global modal
        if (window.AppModal) {
            window.AppModal.setLanguage(this.language);
        }
        this.renderConfig();
        this.initReordering();
        
        if (typeof initCustomSelects === 'function') {
            setTimeout(() => initCustomSelects(), 0);
        }

        document.body.classList.remove('loading');

        const categoriesSelector = document.getElementById('categories-page-selector');
        if (categoriesSelector) {
            this.currentCategoriesPageId = parseInt(this.currentPageId);
            this.loadPageCategories(this.currentPageId);
        }
        this.savedSnapshot = this.captureUndoSnapshot();
        this.refreshSmartCollectionCounters();
        this.validateBookmarkConflicts({ showToast: false });
        if (this.stats && window.location.hash === '#stats') {
            this.stats.refresh(this);
        }
    }

    async loadData() {
        try {
            this.deviceSpecific = this.storage.getDeviceSpecificFlag();
            const { bookmarks, pages, settings } = await this.data.loadData(this.deviceSpecific);

            this.bookmarksData = bookmarks;
            this.pagesData = pages;
            this.originalPagesData = JSON.parse(JSON.stringify(pages));
            this.findersData = await this.data.loadFinders();
            try {
                const allBookmarksResponse = await fetch('/api/bookmarks?all=true');
                this.allBookmarksData = allBookmarksResponse.ok ? await allBookmarksResponse.json() : [];
            } catch (error) {
                this.allBookmarksData = [];
            }
            this.settingsData = { ...this.settingsData, ...settings };
            if (!this.settingsData.language || this.settingsData.language === "") {
                this.settingsData.language = 'en';
            }
            if (typeof this.settingsData.interleaveMode === 'undefined') {
                this.settingsData.interleaveMode = false;
            }
            if (typeof this.settingsData.showPageTabs === 'undefined') {
                this.settingsData.showPageTabs = true;
            }
            if (typeof this.settingsData.showSmartRecentCollection === 'undefined') {
                this.settingsData.showSmartRecentCollection = false;
            }
            if (typeof this.settingsData.showSmartStaleCollection === 'undefined') {
                this.settingsData.showSmartStaleCollection = false;
            }
            if (typeof this.settingsData.showRecentButton === 'undefined') {
                this.settingsData.showRecentButton = true;
            }
            if (typeof this.settingsData.showTips === 'undefined') {
                this.settingsData.showTips = true;
            }
            if (typeof this.settingsData.showSyncToasts === 'undefined') {
                this.settingsData.showSyncToasts = true;
            }
            if (typeof this.settingsData.onboardingCompleted === 'undefined') {
                this.settingsData.onboardingCompleted = true;
            }
            if (!Number.isFinite(Number(this.settingsData.smartRecentLimit)) || Number(this.settingsData.smartRecentLimit) < 0) {
                this.settingsData.smartRecentLimit = 50;
            } else {
                this.settingsData.smartRecentLimit = Number(this.settingsData.smartRecentLimit);
            }
            if (!Number.isFinite(Number(this.settingsData.smartStaleLimit)) || Number(this.settingsData.smartStaleLimit) < 0) {
                this.settingsData.smartStaleLimit = 50;
            } else {
                this.settingsData.smartStaleLimit = Number(this.settingsData.smartStaleLimit);
            }
            if (!Array.isArray(this.settingsData.smartRecentPageIds)) {
                this.settingsData.smartRecentPageIds = [];
            }
            if (!Array.isArray(this.settingsData.smartStalePageIds)) {
                this.settingsData.smartStalePageIds = [];
            }
            if (!Array.isArray(this.settingsData.smartMostUsedPageIds)) {
                this.settingsData.smartMostUsedPageIds = [];
            }
            if (typeof this.settingsData.showSmartMostUsedCollection === 'undefined') {
                this.settingsData.showSmartMostUsedCollection = false;
            }
            if (!Number.isFinite(Number(this.settingsData.smartMostUsedLimit)) || Number(this.settingsData.smartMostUsedLimit) < 0) {
                this.settingsData.smartMostUsedLimit = 25;
            } else {
                this.settingsData.smartMostUsedLimit = Number(this.settingsData.smartMostUsedLimit);
            }
            this.currentPageId = settings.currentPage || 1;
            
            await this.loadPageBookmarks(this.currentPageId);
        } catch (error) {
            this.ui.showNotification(this.language.t('config.errorLoadingConfig'), 'error');
        }
    }

    async loadPageBookmarks(pageId) {
        try {
            this.currentPageId = parseInt(pageId);
            this.bookmarksData = await this.data.loadBookmarksByPage(pageId);
            this.bookmarksPageCategories = (await this.data.loadCategoriesByPage(pageId)).map(cat => ({ ...cat }));

            this.refreshBookmarksFilterOptions();
            this.refreshBookmarksList();
        } catch (error) {
            this.ui.showNotification(this.language.t('config.errorLoadingBookmarks'), 'error');
        }
    }

    async loadPageCategories(pageId) {
        try {
            this.currentCategoriesPageId = parseInt(pageId);
            this.categoriesData = (await this.data.loadCategoriesByPage(pageId)).map(cat => ({ ...cat }));
            this.categories.render(this.categoriesData, this.generateId.bind(this));
            this.categories.initReorder(this.categoriesData, (newCategories) => {
                this.categoriesData = newCategories;
            });
        } catch (error) {
            this.ui.showNotification(this.language.t('config.errorLoadingCategories'), 'error');
        }
    }

    setupDOM() {
        this.settings.applyTheme(this.settingsData.theme);
        this.settings.applyFontSize(this.settingsData.fontSize);
        this.settings.applyBackgroundDots(this.settingsData.showBackgroundDots);
        this.settings.applyAnimations(this.settingsData.animationsEnabled);
        if (window.LayoutUtils) {
            this.settingsData.layoutPreset = window.LayoutUtils.applyLayoutPreset(this.settingsData, this.settingsData.layoutPreset || 'default');
        } else {
            document.body.setAttribute('data-layout-preset', this.settingsData.layoutPreset || 'default');
        }
        this.settings.applyBackgroundOpacity(this.settingsData.backgroundOpacity);
        this.settings.applyFontWeight(this.settingsData.fontWeight);
        this.settings.applyAutoDarkMode(this.settingsData.autoDarkMode, this.settingsData);
    }

    async setupEventListeners() {
        // Setup input validation
        this.setupInputValidation();
        
        // Setup settings listeners with callbacks
        await this.settings.setupListeners(this.settingsData, {
            onThemeChange: (theme) => {
                this.settings.applyTheme(theme);
            },
            onFontSizeChange: (fontSize) => {
                this.settings.applyFontSize(fontSize);
            },
            onBackgroundDotsChange: (show) => {
                this.settings.applyBackgroundDots(show);
            },
            onAnimationsChange: (enabled) => {
                this.settings.applyAnimations(enabled);
            },
            onLayoutPresetChange: (preset) => {
                if (window.LayoutUtils) {
                    this.settingsData.layoutPreset = window.LayoutUtils.applyLayoutPreset(this.settingsData, preset || 'default');
                } else {
                    document.body.setAttribute('data-layout-preset', preset || 'default');
                }
            },
            onBackgroundOpacityChange: (value) => {
                this.settings.applyBackgroundOpacity(value);
            },
            onFontWeightChange: (value) => {
                this.settings.applyFontWeight(value);
            },
            onAutoDarkModeChange: (enabled) => {
                this.settings.applyAutoDarkMode(enabled, this.settingsData);
            },
            onStatusVisibilityChange: () => {
                this.settings.updateStatusOptionsVisibility(this.settingsData.showStatus);
            }
        });



        const deviceSpecificCheckbox = document.getElementById('device-specific-checkbox');
        if (deviceSpecificCheckbox) {
            deviceSpecificCheckbox.checked = this.deviceSpecific;
            deviceSpecificCheckbox.addEventListener('change', async (e) => {
                this.deviceSpecific = e.target.checked;
                this.storage.setDeviceSpecificFlag(this.deviceSpecific);
                
                const message = this.deviceSpecific 
                    ? this.language.t('config.deviceSpecificEnabled')
                    : this.language.t('config.deviceSpecificDisabled');
                
                if (this.deviceSpecific) {
                    this.storage.saveDeviceSettings(this.settingsData);
                } else {
                    this.storage.clearDeviceSettings();
                }
                this.ui.showNotification(message, 'success');
            });
        }

        this.settings.updateStatusOptionsVisibility(this.settingsData.showStatus);

        const addPageBtn = document.getElementById('add-page-btn');
        if (addPageBtn) addPageBtn.addEventListener('click', () => this.addPage());

        const addCategoryBtn = document.getElementById('add-category-btn');
        if (addCategoryBtn) addCategoryBtn.addEventListener('click', () => this.addCategory());

        const addBookmarkBtn = document.getElementById('add-bookmark-btn');
        if (addBookmarkBtn) addBookmarkBtn.addEventListener('click', () => this.addBookmark());

        const selectAllBookmarksBtn = document.getElementById('select-all-bookmarks-btn');
        if (selectAllBookmarksBtn) {
            selectAllBookmarksBtn.addEventListener('click', () => {
                this.bookmarks.selectAllVisible();
            });
        }

        const clearBookmarkSelectionBtn = document.getElementById('clear-bookmark-selection-btn');
        if (clearBookmarkSelectionBtn) {
            clearBookmarkSelectionBtn.addEventListener('click', () => {
                this.bookmarks.clearSelection();
            });
        }

        const bulkDeleteBookmarksBtn = document.getElementById('bulk-delete-bookmarks-btn');
        if (bulkDeleteBookmarksBtn) {
            bulkDeleteBookmarksBtn.addEventListener('click', async () => {
                const undoSnapshot = this.captureUndoSnapshot();
                const removed = await this.bookmarks.bulkDelete(this.bookmarksData);
                if (removed) {
                    this.refreshBookmarksList();
                    this.showUndoNotification('Bookmarks removed.', undoSnapshot);
                    this.markDirty();
                }
            });
        }

        const bulkApplyCategoryBtn = document.getElementById('bulk-apply-category-btn');
        const bulkCategorySelect = document.getElementById('bulk-category-select');
        if (bulkApplyCategoryBtn && bulkCategorySelect) {
            bulkApplyCategoryBtn.addEventListener('click', () => {
                this.bookmarks.bulkUpdateCategory(this.bookmarksData, bulkCategorySelect.value);
                this.refreshBookmarksList();
                this.markDirty();
            });
        }

        const bulkTogglePinBtn = document.getElementById('bulk-toggle-pin-btn');
        if (bulkTogglePinBtn) {
            bulkTogglePinBtn.addEventListener('click', () => {
                this.bookmarks.bulkTogglePin(this.bookmarksData);
                this.refreshBookmarksList();
                this.markDirty();
            });
        }

        const addFinderBtn = document.getElementById('add-finder-btn');
        if (addFinderBtn) addFinderBtn.addEventListener('click', () => this.addFinder());

        const pageSelector = document.getElementById('page-selector');
        if (pageSelector) {
            pageSelector.addEventListener('change', (e) => this.loadPageBookmarks(e.target.value));
        }

        const bookmarksFilterSelector = document.getElementById('bookmarks-category-filter');
        if (bookmarksFilterSelector) {
            bookmarksFilterSelector.addEventListener('change', (e) => {
                this.currentBookmarksCategoryFilter = e.target.value;
                this.refreshBookmarksList();
            });
        }

        const categoriesPageSelector = document.getElementById('categories-page-selector');
        if (categoriesPageSelector) {
            categoriesPageSelector.addEventListener('change', (e) => {
                this.currentCategoriesPageId = parseInt(e.target.value);
                this.loadPageCategories(e.target.value);
            });
        }

        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveChanges());

        const undoTopBtn = document.getElementById('undo-top-btn');
        if (undoTopBtn) {
            undoTopBtn.addEventListener('click', () => {
                if (this.undoSnapshot) {
                    this.restoreUndoSnapshot(this.undoSnapshot);
                    this.undoSnapshot = null;
                    this.ui.showNotification('Undone.', 'success');
                }
            });
        }

        const discardTopBtn = document.getElementById('discard-top-btn');
        if (discardTopBtn) discardTopBtn.addEventListener('click', () => this.discardChanges());

        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetToDefaults());
        this.setupStructureAutoSyncListeners();
        this.setupDirtyTracking();
    }

    setupStructureAutoSyncListeners() {
        const pagesList = document.getElementById('pages-list');
        if (pagesList) {
            pagesList.addEventListener('change', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement)) return;
                if (target.getAttribute('data-field') !== 'name') return;
                await this.persistPagesStructureAndRefresh('page-renamed');
            });
        }

        const categoriesList = document.getElementById('categories-list');
        if (categoriesList) {
            categoriesList.addEventListener('change', async (event) => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement)) return;
                if (target.getAttribute('data-field') !== 'name') return;
                const row = target.closest('.category-item');
                const category = row ? row._categoryRef : null;
                if (!category) return;
                const categoryBeforeRename = category.originalId || category.id;
                const renameResult = this.applyCategoryRenameWithConflictGuard(category, target.value, categoryBeforeRename);
                if (!renameResult) {
                    return;
                }
                await this.persistCategoriesStructureAndRefresh({
                    persistBookmarks: true,
                    eventType: 'category-renamed',
                    categoryRenameMap: renameResult
                });
            });
        }
    }

    applyCategoryRenameWithConflictGuard(category, rawName, previousId) {
        const nextName = String(rawName || '').trim();
        const nextId = this.generateId(nextName);
        const originalName = category.name || '';
        const currentId = category.id || '';
        const oldId = previousId || category.originalId || currentId;
        const hasDuplicate = this.categoriesData.some((item) => item !== category && item.id === nextId);

        if (!nextName || !nextId || hasDuplicate) {
            const fallbackName = originalName || oldId || this.language.t('config.newCategoryPrefix');
            category.name = fallbackName;
            category.id = oldId;
            category.originalId = oldId;
            this.categories.render(this.categoriesData, this.generateId.bind(this));
            this.categories.initReorder(this.categoriesData, (newCategories) => {
                this.categoriesData = newCategories;
            });
            this.ui.showNotification('Category name must be unique and not empty.', 'error');
            return false;
        }

        category.name = nextName;
        category.id = nextId;
        category.originalId = nextId;
        this.reassignBookmarkCategoryIds(oldId, nextId);
        return { oldId, newId: nextId };
    }

    reassignBookmarkCategoryIds(oldId, nextId) {
        if (!oldId || !nextId || oldId === nextId) {
            return;
        }
        this.bookmarksData.forEach((bookmark) => {
            if (bookmark.category === oldId) {
                bookmark.category = nextId;
            }
        });
    }

    async withRetry(task, options = {}) {
        const retries = Number(options.retries ?? 2);
        const baseDelayMs = Number(options.baseDelayMs ?? 250);
        let lastError = null;

        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                return await task();
            } catch (error) {
                lastError = error;
                if (attempt >= retries) {
                    break;
                }
                const delayMs = baseDelayMs * (2 ** attempt);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        throw lastError;
    }

    signalDashboardReload(eventType = 'structure-updated') {
        try {
            const payload = {
                type: eventType,
                sourceTabId: this.tabId,
                timestamp: Date.now()
            };
            localStorage.setItem(this.structureSyncEventKey, JSON.stringify(payload));
        } catch (error) {
            // Keep config functional even if storage access is blocked.
        }
    }

    signalDashboardSettingsUpdated(eventType = 'settings-updated') {
        try {
            const payload = {
                type: eventType,
                sourceTabId: this.tabId,
                timestamp: Date.now()
            };
            localStorage.setItem(this.settingsSyncEventKey, JSON.stringify(payload));
        } catch (error) {
            // Keep config functional even if storage access is blocked.
        }
    }

    showSyncToast(message, type = 'success') {
        if (this.settingsData?.showSyncToasts === false) {
            return;
        }
        const now = Date.now();
        if (now - this.lastSyncToastAt < 2000) {
            return;
        }
        this.lastSyncToastAt = now;
        this.ui.showNotification(message, type);
    }

    async persistPagesStructureAndRefresh(eventType = 'page-updated') {
        try {
            await this.withRetry(() => this.data.savePages(this.pagesData));
            await this.refreshStructureDependentUI();
            this.signalDashboardReload(eventType);
            this.showSyncToast('Dashboard sync complete.', 'success');
        } catch (error) {
            console.error('Error persisting page structure:', error);
            this.showSyncToast('Dashboard sync failed. Retry from config.', 'error');
        }
    }

    async persistCategoriesStructureAndRefresh(options = {}) {
        if (!this.currentCategoriesPageId) {
            return;
        }

        try {
            const categoriesForSelectedPage = this.getCategoriesFromDOM();
            if (categoriesForSelectedPage && categoriesForSelectedPage.length >= 0) {
                this.categoriesData = categoriesForSelectedPage;
                await this.withRetry(() => this.data.saveCategoriesByPage(categoriesForSelectedPage, this.currentCategoriesPageId));
            }

            if (options.persistBookmarks === true) {
                const renameMap = options.categoryRenameMap || null;
                if (this.currentPageId === this.currentCategoriesPageId) {
                    if (renameMap && renameMap.oldId && renameMap.newId && renameMap.oldId !== renameMap.newId) {
                        this.reassignBookmarkCategoryIds(renameMap.oldId, renameMap.newId);
                    }
                    await this.withRetry(() => this.data.saveBookmarks(this.bookmarksData, this.currentPageId));
                } else {
                    const pageBookmarks = await this.withRetry(() => this.data.loadBookmarksByPage(this.currentCategoriesPageId));
                    let changed = false;
                    const categoryIdSet = new Set(this.categoriesData.map((category) => category.id));
                    const nextBookmarks = pageBookmarks.map((bookmark) => {
                        if (renameMap && bookmark.category === renameMap.oldId) {
                            changed = true;
                            return { ...bookmark, category: renameMap.newId };
                        }
                        if (bookmark.category && !categoryIdSet.has(bookmark.category)) {
                            changed = true;
                            return { ...bookmark, category: '' };
                        }
                        return bookmark;
                    });
                    if (changed) {
                        await this.withRetry(() => this.data.saveBookmarks(nextBookmarks, this.currentCategoriesPageId));
                    }
                }
            }

            await this.refreshStructureDependentUI();
            this.signalDashboardReload(options.eventType || 'category-updated');
            this.showSyncToast('Dashboard sync complete.', 'success');
        } catch (error) {
            console.error('Error persisting category structure:', error);
            this.showSyncToast('Dashboard sync failed. Retry from config.', 'error');
        }
    }

    async refreshStructureDependentUI() {
        const previousPageId = Number(this.currentPageId) || 1;
        const previousCategoriesPageId = Number(this.currentCategoriesPageId) || previousPageId;
        const selectedPageExists = this.pagesData.some((page) => Number(page.id) === previousPageId);
        const selectedCategoriesPageExists = this.pagesData.some((page) => Number(page.id) === previousCategoriesPageId);

        this.currentPageId = selectedPageExists ? previousPageId : (this.pagesData[0]?.id || 1);
        this.currentCategoriesPageId = selectedCategoriesPageExists ? previousCategoriesPageId : this.currentPageId;

        await this.loadPageBookmarks(this.currentPageId);
        await this.loadPageCategories(this.currentCategoriesPageId);
        this.renderConfig();
        this.initReordering();
    }

    setupDirtyTracking() {
        const root = document.querySelector('.config-main');
        if (!root) {
            return;
        }
        const mark = () => {
            this.markDirty();
            this.validateBookmarkConflicts({ showToast: false });
        };
        const shouldIgnoreTarget = (target) => {
            if (!target || !target.id) return false;
            return target.id === 'page-selector' || target.id === 'categories-page-selector' || target.id === 'bookmarks-category-filter';
        };
        root.addEventListener('input', (event) => {
            if (this.suppressDirtyTracking) return;
            if (event.target && event.target.closest('#notification')) return;
            if (shouldIgnoreTarget(event.target)) return;
            mark();
        });
        root.addEventListener('change', (event) => {
            if (this.suppressDirtyTracking) return;
            if (event.target && event.target.closest('#notification')) return;
            if (shouldIgnoreTarget(event.target)) return;
            mark();
        });
        window.addEventListener('beforeunload', (event) => {
            if (!this.isDirty) return;
            event.preventDefault();
            event.returnValue = '';
        });
        this.setDirtyState(false);
    }

    setDirtyState(isDirty) {
        this.isDirty = isDirty === true;
        const saveBtn = document.getElementById('save-btn');
        const badge = document.getElementById('unsaved-indicator');
        const saveStatus = document.getElementById('save-status-indicator');
        const undoTopBtn = document.getElementById('undo-top-btn');
        const discardTopBtn = document.getElementById('discard-top-btn');
        if (saveBtn) {
            saveBtn.classList.toggle('has-unsaved', this.isDirty);
        }
        if (badge) {
            badge.classList.toggle('is-visible', this.isDirty);
        }
        if (saveStatus) {
            saveStatus.textContent = this.isDirty ? 'Unsaved changes' : 'Saved';
            saveStatus.classList.toggle('is-unsaved', this.isDirty);
        }
        if (undoTopBtn) {
            undoTopBtn.disabled = !this.undoSnapshot;
            undoTopBtn.classList.toggle('is-visible', this.isDirty);
        }
        if (discardTopBtn) {
            discardTopBtn.disabled = !this.isDirty;
            discardTopBtn.classList.toggle('is-visible', this.isDirty);
        }
    }

    markDirty() {
        this.setDirtyState(true);
    }

    clearDirty() {
        this.setDirtyState(false);
    }

    captureUndoSnapshot() {
        return {
            bookmarksData: JSON.parse(JSON.stringify(this.bookmarksData || [])),
            categoriesData: JSON.parse(JSON.stringify(this.categoriesData || [])),
            findersData: JSON.parse(JSON.stringify(this.findersData || [])),
            settingsData: JSON.parse(JSON.stringify(this.settingsData || {})),
            pagesData: JSON.parse(JSON.stringify(this.pagesData || [])),
            currentPageId: this.currentPageId,
            currentCategoriesPageId: this.currentCategoriesPageId,
            currentBookmarksCategoryFilter: this.currentBookmarksCategoryFilter
        };
    }

    restoreUndoSnapshot(snapshot) {
        if (!snapshot) return;
        this.suppressDirtyTracking = true;
        this.bookmarksData = snapshot.bookmarksData;
        this.categoriesData = snapshot.categoriesData;
        this.findersData = snapshot.findersData;
        this.settingsData = snapshot.settingsData;
        this.pagesData = snapshot.pagesData;
        this.currentPageId = snapshot.currentPageId;
        this.currentCategoriesPageId = snapshot.currentCategoriesPageId;
        this.currentBookmarksCategoryFilter = snapshot.currentBookmarksCategoryFilter || '__all__';
        this.renderConfig();
        this.initReordering();
        this.refreshBookmarksFilterOptions();
        this.refreshBookmarksList();
        this.suppressDirtyTracking = false;
        this.markDirty();
    }

    showUndoNotification(message, snapshot = null) {
        const activeSnapshot = snapshot || this.captureUndoSnapshot();
        if (!activeSnapshot) return;
        this.undoSnapshot = activeSnapshot;
        this.setDirtyState(this.isDirty);
        this.ui.showNotification(message, 'warning', {
            actionLabel: 'Undo',
            durationMs: 8000,
            onAction: () => {
                this.restoreUndoSnapshot(this.undoSnapshot);
                this.undoSnapshot = null;
                this.setDirtyState(this.isDirty);
                this.ui.showNotification('Undone.', 'success');
            }
        });
    }

    setupGeneralCardCollapsible() {
        const cards = document.querySelectorAll('.general-card');
        cards.forEach((card, index) => {
            const title = card.querySelector('.section-title');
            if (!title) return;
            card.classList.add('is-collapsible');
            if (index > 1) {
                card.classList.add('is-collapsed');
            }
            title.addEventListener('click', () => {
                card.classList.toggle('is-collapsed');
            });
        });
    }

    async refreshSmartCollectionCounters() {
        try {
            const res = await fetch('/api/bookmarks?all=true');
            if (!res.ok) return;
            const allBookmarks = await res.json();
            const list = Array.isArray(allBookmarks) ? allBookmarks : [];
            const now = Date.now();
            const weekMs = 7 * 24 * 60 * 60 * 1000;
            const staleMs = 30 * 24 * 60 * 60 * 1000;

            const recentCount = list.filter((bookmark) => {
                const lastOpened = Number(bookmark?.lastOpened || 0);
                return lastOpened > 0 && (now - lastOpened) <= weekMs;
            }).length;
            const staleCount = list.filter((bookmark) => {
                const lastOpened = Number(bookmark?.lastOpened || 0);
                return lastOpened === 0 || (now - lastOpened) > staleMs;
            }).length;
            const mostUsedCount = list.filter((bookmark) => Number(bookmark?.openCount || 0) > 0).length;

            const setBadge = (id, count) => {
                const el = document.getElementById(id);
                if (el) el.textContent = String(count);
            };
            setBadge('smart-recent-count-badge', recentCount);
            setBadge('smart-stale-count-badge', staleCount);
            setBadge('smart-most-used-count-badge', mostUsedCount);
        } catch (error) {
            // Keep config functional even if counters fail.
        }
    }

    async discardChanges() {
        if (!this.isDirty) {
            return;
        }
        const confirmed = await window.AppModal.danger({
            title: 'Discard unsaved changes',
            message: 'Revert all unsaved changes from this session?',
            confirmText: 'Discard',
            cancelText: 'Cancel'
        });
        if (!confirmed) {
            return;
        }
        window.location.reload();
    }

    setupCascadingCheckboxes() {
        // Define parent-child relationships for checkboxes
        const cascadingPairs = [
            { parent: 'show-search-button-checkbox', children: ['show-search-button-text-checkbox'] },
            { parent: 'show-finders-button-checkbox', children: ['show-finders-button-text-checkbox'] },
            { parent: 'show-commands-button-checkbox', children: ['show-commands-button-text-checkbox'] },
            { parent: 'show-status-checkbox', children: ['show-ping-checkbox', 'show-status-loading-checkbox', 'skip-fast-ping-checkbox'] },
            { parent: 'enable-custom-title-checkbox', children: ['custom-title-input', 'show-page-in-title-checkbox'] },
            { parent: 'enable-fuzzy-suggestions-checkbox', children: ['fuzzy-suggestions-start-with-checkbox'] },
            { parent: 'enable-custom-favicon-checkbox', children: ['custom-favicon-input'] },
            { parent: 'enable-custom-font-checkbox', children: ['custom-font-input'] }
        ];

        // Set up event listeners for each parent checkbox
        cascadingPairs.forEach(pair => {
            const parentCheckbox = document.getElementById(pair.parent);
            if (parentCheckbox) {
                parentCheckbox.addEventListener('change', (e) => {
                    pair.children.forEach(childId => {
                        const childElement = document.getElementById(childId);
                        if (childElement) {
                            if (childElement.type === 'checkbox') {
                                childElement.disabled = !e.target.checked;
                                // Visual feedback: gray out child if disabled
                                const parentItem = childElement.closest('.checkbox-tree-child');
                                if (parentItem) {
                                    if (!e.target.checked) {
                                        parentItem.style.opacity = '0.5';
                                        parentItem.style.pointerEvents = 'none';
                                    } else {
                                        parentItem.style.opacity = '1';
                                        parentItem.style.pointerEvents = 'auto';
                                    }
                                }
                            } else if (childElement.type === 'file' || childElement.tagName === 'INPUT') {
                                childElement.disabled = !e.target.checked;
                                const parentItem = childElement.closest('.checkbox-tree-child');
                                if (parentItem) {
                                    if (!e.target.checked) {
                                        parentItem.style.opacity = '0.5';
                                        parentItem.style.pointerEvents = 'none';
                                    } else {
                                        parentItem.style.opacity = '1';
                                        parentItem.style.pointerEvents = 'auto';
                                    }
                                }
                            }
                        }
                    });
                });
                
                // Initialize disabled state on load
                const isChecked = parentCheckbox.checked;
                pair.children.forEach(childId => {
                    const childElement = document.getElementById(childId);
                    if (childElement) {
                        childElement.disabled = !isChecked;
                        if (!isChecked) {
                            const parentItem = childElement.closest('.checkbox-tree-child');
                            if (parentItem) {
                                parentItem.style.opacity = '0.5';
                                parentItem.style.pointerEvents = 'none';
                            }
                        }
                    }
                });
            }
        });
    }

    setupInputValidation() {
        // Validate columns input (1-6)
        const columnsInput = document.getElementById('columns-input');
        if (columnsInput) {
            columnsInput.addEventListener('input', (e) => {
                let value = parseInt(e.target.value);
                if (isNaN(value)) value = 3;
                if (value < 1) value = 1;
                if (value > 6) value = 6;
                e.target.value = value;
            });
        }

        // Validate custom title (max length handled by maxlength attribute)
        const customTitleInput = document.getElementById('custom-title-input');
        if (customTitleInput) {
            customTitleInput.addEventListener('input', (e) => {
                // Show character count feedback if near limit
                if (e.target.value.length > 85) {
                    e.target.title = `${e.target.value.length} / 100 characters`;
                } else {
                    e.target.title = '';
                }
            });
        }

        // File input validation
        const faviconInput = document.getElementById('custom-favicon-input');
        if (faviconInput) {
            faviconInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const maxSize = 1024 * 1024; // 1MB
                    if (file.size > maxSize) {
                        this.ui.showNotification(this.language.t('config.fileTooLarge') || 'File is too large (max 1MB)', 'error');
                        e.target.value = '';
                        return;
                    }
                    const validTypes = ['image/x-icon', 'image/png', 'image/jpeg', 'image/gif'];
                    if (!validTypes.includes(file.type)) {
                        this.ui.showNotification(this.language.t('config.invalidFileType') || 'Invalid file type', 'error');
                        e.target.value = '';
                    }
                }
            });
        }

        const fontInput = document.getElementById('custom-font-input');
        if (fontInput) {
            fontInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (file.size > maxSize) {
                        this.ui.showNotification(this.language.t('config.fileTooLarge') || 'File is too large (max 5MB)', 'error');
                        e.target.value = '';
                        return;
                    }
                    const validTypes = ['font/woff', 'font/woff2', 'font/ttf', 'font/otf'];
                    if (!validTypes.includes(file.type)) {
                        this.ui.showNotification(this.language.t('config.invalidFileType') || 'Invalid file type', 'error');
                        e.target.value = '';
                    }
                }
            });
        }
    }

    renderConfig() {
        this.pages.render(this.pagesData, this.generateId.bind(this));
        if (this.settings && typeof this.settings.populateSmartPageSelectors === 'function') {
            this.settings.populateSmartPageSelectors(this.pagesData, this.settingsData);
        }
        
        const pageSelector = document.getElementById('page-selector');
        if (pageSelector && pageSelector.value) {
            this.currentPageId = parseInt(pageSelector.value);
        }
        this.pages.renderPageSelector(this.pagesData, this.currentPageId);

        const categoriesSelector = document.getElementById('categories-page-selector');
        if (categoriesSelector) {
            if (categoriesSelector.value) {
                this.currentCategoriesPageId = parseInt(categoriesSelector.value);
            }
            
            categoriesSelector.innerHTML = '';
            this.pagesData.forEach(page => {
                const option = document.createElement('option');
                option.value = page.id;
                option.textContent = page.name;
                if (page.id === this.currentCategoriesPageId) option.selected = true;
                categoriesSelector.appendChild(option);
            });
        }

        this.refreshBookmarksFilterOptions();
        this.refreshBookmarksList();
        this.finders.render(this.findersData);
        this.refreshCustomSelects();
        
        // Set checkbox states
        const interleaveModeCheckbox = document.getElementById('interleave-mode-checkbox');
        if (interleaveModeCheckbox) interleaveModeCheckbox.checked = this.settingsData.interleaveMode;
    }

    refreshCustomSelects() {
        const selects = document.querySelectorAll('select[data-custom-select-init="true"]');
        
        selects.forEach(select => {
            const wrapper = select.closest('.custom-select-wrapper');
            if (!wrapper) return;

            const optionsContainer = wrapper.querySelector('.custom-select-options');
            const trigger = wrapper.querySelector('.custom-select-trigger .custom-select-text');
            
            if (optionsContainer && trigger) {
                optionsContainer.innerHTML = '';
                
                Array.from(select.options).forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'custom-select-option';
                    optionDiv.textContent = option.textContent;
                    optionDiv.dataset.value = option.value;
                    optionDiv.dataset.index = index;
                    
                    if (option.selected) optionDiv.classList.add('selected');
                    
                    optionDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        select.selectedIndex = index;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        trigger.textContent = option.textContent;
                        optionsContainer.querySelectorAll('.custom-select-option').forEach(opt => {
                            opt.classList.remove('selected');
                        });
                        optionDiv.classList.add('selected');
                        wrapper.querySelector('.custom-select').classList.remove('open');
                    });
                    
                    optionsContainer.appendChild(optionDiv);
                });
                
                const selectedOption = select.options[select.selectedIndex];
                if (selectedOption) trigger.textContent = selectedOption.textContent;
            }
        });
    }

    initReordering() {
        this.pages.initReorder(this.pagesData, (newPages) => {
            this.pagesData = newPages;
            this.pages.renderPageSelector(this.pagesData, this.currentPageId);
        });

        this.categories.initReorder(this.categoriesData, (newCategories) => {
            this.categoriesData = newCategories;
        });

        this.refreshBookmarksList();

        this.finders.initReorder(this.findersData, (newFinders) => {
            this.findersData = newFinders;
        });
    }

    async addPage() {
        const newPage = this.pages.add(this.pagesData, this.generateId.bind(this));
        
        const defaultCategories = [{ id: 'others', name: this.language.t('dashboard.others') }];
        try {
            await this.data.saveCategoriesByPage(defaultCategories, newPage.id);
            await this.data.saveBookmarks([], newPage.id);
        } catch (error) {
            console.error('Error creating new page:', error);
        }
        
        this.pages.render(this.pagesData, this.generateId.bind(this));
        this.pages.renderPageSelector(this.pagesData, newPage.id);
        this.pages.initReorder(this.pagesData, (newPages) => {
            this.pagesData = newPages;
            this.pages.renderPageSelector(this.pagesData, this.currentPageId);
        });

        const pageSelector = document.getElementById('page-selector');
        if (pageSelector) {
            pageSelector.value = String(newPage.id);
            this.currentPageId = newPage.id;
            this.loadPageBookmarks(newPage.id);
        }

        const categoriesSelector = document.getElementById('categories-page-selector');
        if (categoriesSelector) {
            categoriesSelector.innerHTML = '';
            this.pagesData.forEach(page => {
                const option = document.createElement('option');
                option.value = page.id;
                option.textContent = page.name;
                if (page.id === newPage.id) option.selected = true;
                categoriesSelector.appendChild(option);
            });
            
            this.currentCategoriesPageId = newPage.id;
            this.loadPageCategories(newPage.id);
        }

        await this.persistPagesStructureAndRefresh('page-added');
    }

    async addCategory() {
        if (!this.categoriesData) this.categoriesData = [];
        
        this.categories.add(this.categoriesData, this.generateId.bind(this));
        this.categories.render(this.categoriesData, this.generateId.bind(this));
        this.categories.initReorder(this.categoriesData, (newCategories) => {
            this.categoriesData = newCategories;
        });
        this.markDirty();
        await this.persistCategoriesStructureAndRefresh({ eventType: 'category-added' });
    }

    addBookmark() {
        const newBookmark = this.bookmarks.add(this.bookmarksData);
        this.warnDuplicateUrl(newBookmark.url);
        this.refreshBookmarksList();
        this.markDirty();
    }

    addFinder() {
        this.finders.add(this.findersData);
        this.finders.render(this.findersData);
        this.finders.initReorder(this.findersData, (newFinders) => {
            this.findersData = newFinders;
        });
        this.markDirty();
    }

    async removePage(index) {
        const page = this.pagesData[index];
        if (!page) return;
        
        if (page.id === 1) {
            this.ui.showNotification(this.language.t('config.cannotRemoveMainPage'), 'error');
            return;
        }
        
        const confirmed = await window.AppModal.danger({
            title: this.language.t('config.removePageTitle'),
            message: this.language.t('config.removePageMessage').replace('{pageName}', page.name),
            confirmText: this.language.t('config.remove'),
            cancelText: this.language.t('config.cancel')
        });
        
        if (!confirmed) return;
        
        try {
            await this.data.deletePage(page.id);
            
            this.pagesData.splice(index, 1);
            
            const origIndex = this.originalPagesData.findIndex(p => p.id === page.id);
            if (origIndex !== -1) {
                this.originalPagesData.splice(origIndex, 1);
            }
            
            this.pages.render(this.pagesData, this.generateId.bind(this));
            this.pages.renderPageSelector(this.pagesData, 1);
            this.pages.initReorder(this.pagesData, (newPages) => {
                this.pagesData = newPages;
                this.pages.renderPageSelector(this.pagesData, this.currentPageId);
            });
            
            this.currentPageId = 1;
            this.currentCategoriesPageId = 1;
            await this.loadPageBookmarks(1);
            await this.loadPageCategories(1);
            
            const pageSelector = document.getElementById('page-selector');
            if (pageSelector) pageSelector.value = '1';
            
            const categoriesSelector = document.getElementById('categories-page-selector');
            if (categoriesSelector) {
                categoriesSelector.innerHTML = '';
                this.pagesData.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.id;
                    option.textContent = p.name;
                    if (p.id === 1) option.selected = true;
                    categoriesSelector.appendChild(option);
                });
            }
            await this.persistPagesStructureAndRefresh('page-removed');
            this.ui.showNotification(this.language.t('config.pageDeleted'), 'success');
        } catch (error) {
            console.error('Error deleting page:', error);
            this.ui.showNotification(this.language.t('config.errorDeletingPage'), 'error');
        }
    }

    async removeCategory(index) {
        const category = this.categoriesData[index];
        if (!category) return;
        
        const undoSnapshot = this.captureUndoSnapshot();
        const removed = await this.categories.remove(this.categoriesData, index);
        if (removed) {
            if (this.currentPageId === this.currentCategoriesPageId) {
                this.bookmarksData.forEach(bookmark => {
                    if (bookmark.category === category.id) {
                        bookmark.category = '';
                    }
                });
            }
            
            this.categories.render(this.categoriesData, this.generateId.bind(this));
            this.categories.initReorder(this.categoriesData, (newCategories) => {
                this.categoriesData = newCategories;
            });
            this.showUndoNotification('Category removed.', undoSnapshot);
            this.markDirty();
            await this.persistCategoriesStructureAndRefresh({ persistBookmarks: true, eventType: 'category-removed' });
        }
    }

    async removeBookmark(index) {
        const undoSnapshot = this.captureUndoSnapshot();
        const removed = await this.bookmarks.remove(this.bookmarksData, index);
        if (removed) {
            this.refreshBookmarksList();
            this.showUndoNotification('Bookmark removed.', undoSnapshot);
            this.markDirty();
        }
    }

    async removeFinder(index) {
        const undoSnapshot = this.captureUndoSnapshot();
        const removed = await this.finders.remove(this.findersData, index);
        if (removed) {
            this.finders.render(this.findersData);
            this.finders.initReorder(this.findersData, (newFinders) => {
                this.findersData = newFinders;
            });
            this.showUndoNotification('Finder removed.', undoSnapshot);
            this.markDirty();
        }
    }

    async moveBookmark(index) {
        const bookmark = this.bookmarksData[index];
        if (!bookmark) return;

        // Create page options
        const pageOptions = this.pagesData
            .map(page => {
                const isCurrent = page.id === this.currentPageId;
                return `<button class="modal-page-btn ${isCurrent ? 'current' : ''}" ${isCurrent ? 'disabled' : `onclick="window.tempMoveBookmark(${index}, ${page.id})"`}>${page.name}${isCurrent ? ' (current)' : ''}</button>`;
            })
            .join('');

        const html = `
            <p>${this.language.t('config.moveBookmarkMessage')}</p>
            <div class="modal-page-list">
                ${pageOptions}
            </div>
        `;

        // Define temp function
        window.tempMoveBookmark = async (idx, pid) => {
            await this.doMoveBookmark(idx, pid);
            AppModal.hide();
        };

        await window.AppModal.confirm({
            title: this.language.t('config.moveBookmarkTitle'),
            htmlMessage: html,
            confirmText: this.language.t('config.cancel'),
            showCancel: false,
            onConfirm: () => {}
        });

        // Clean up
        delete window.tempMoveBookmark;
    }

    async doMoveBookmark(index, newPageId) {
        const bookmark = this.bookmarksData[index];
        if (!bookmark) return;

        if (newPageId === this.currentPageId) {
            this.ui.showNotification(this.language.t('config.bookmarkAlreadyHere'), 'info');
            return;
        }

        try {
            // Remove from current page
            this.bookmarksData.splice(index, 1);

            // Load bookmarks from new page
            const newPageBookmarks = await this.data.loadBookmarksByPage(newPageId);

            // Add bookmark with category cleared
            const movedBookmark = { ...bookmark, category: '' };
            newPageBookmarks.push(movedBookmark);

            // Save both pages
            await this.data.saveBookmarks(this.bookmarksData, this.currentPageId);
            await this.data.saveBookmarks(newPageBookmarks, newPageId);

            // Re-render current page
            this.refreshBookmarksList();

            this.ui.showNotification(this.language.t('config.bookmarkMoved'), 'success');
        } catch (error) {
            console.error('Error moving bookmark:', error);
            this.ui.showNotification(this.language.t('config.errorMovingBookmark'), 'error');
        }
    }

    refreshBookmarksFilterOptions() {
        const filterSelect = document.getElementById('bookmarks-category-filter');
        if (!filterSelect) {
            return;
        }

        const previousValue = this.currentBookmarksCategoryFilter || filterSelect.value || '__all__';
        const options = [];

        options.push({ value: '__all__', label: this.language.t('config.allCategories') || 'All categories' });
        options.push({ value: '__none__', label: this.language.t('config.noCategory') || 'No category' });

        this.bookmarksPageCategories.forEach((category) => {
            options.push({ value: category.id, label: category.name });
        });

        filterSelect.innerHTML = '';
        options.forEach((optionData) => {
            const option = document.createElement('option');
            option.value = optionData.value;
            option.textContent = optionData.label;
            filterSelect.appendChild(option);
        });

        const isStillValid = options.some((option) => option.value === previousValue);
        this.currentBookmarksCategoryFilter = isStillValid ? previousValue : '__all__';
        filterSelect.value = this.currentBookmarksCategoryFilter;

        const bulkCategorySelect = document.getElementById('bulk-category-select');
        if (bulkCategorySelect) {
            bulkCategorySelect.innerHTML = '';
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Move to category...';
            bulkCategorySelect.appendChild(emptyOption);
            options.slice(2).forEach((optionData) => {
                const option = document.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                bulkCategorySelect.appendChild(option);
            });
        }
    }

    refreshBookmarksList(options = {}) {
        this.bookmarks.render(this.bookmarksData, this.bookmarksPageCategories, {
            filterCategory: this.currentBookmarksCategoryFilter
        });
        this.validateBookmarkConflicts({ showToast: false });

        this.bookmarks.initReorder(this.bookmarksData, (newBookmarks, meta = {}) => {
            this.bookmarksData = newBookmarks;
            this.refreshBookmarksList(meta);
            this.markDirty();
        }, {
            filterCategory: this.currentBookmarksCategoryFilter
        });

        if (typeof options.focusIndex === 'number') {
            const focusElement = document.querySelector(`[data-bookmark-index="${options.focusIndex}"] input`);
            if (focusElement) {
                focusElement.focus();
            }
        }

        if (typeof options.highlightIndex === 'number') {
            const highlightElement = document.querySelector(`[data-bookmark-index="${options.highlightIndex}"]`);
            if (highlightElement) {
                highlightElement.classList.add('reorder-highlight');
                setTimeout(() => {
                    highlightElement.classList.remove('reorder-highlight');
                }, 700);
            }
        }
    }

    getCategoriesFromDOM() {
        const categoriesList = document.getElementById('categories-list');
        if (!categoriesList) return null;

        const categoryItems = categoriesList.querySelectorAll('.category-item');
        const categories = [];

        categoryItems.forEach((item) => {
            const category = item._categoryRef;
            if (category) categories.push(category);
        });

        return categories;
    }

    async saveChanges() {
        const conflicts = this.validateBookmarkConflicts({ showToast: true });
        if (conflicts.hasConflicts) {
            return;
        }
        const saveStatus = document.getElementById('save-status-indicator');
        if (saveStatus) {
            saveStatus.textContent = 'Saving...';
            saveStatus.classList.remove('is-unsaved');
        }
        this.ui.showNotification(this.language.t('config.savingChanges'), 'info');

        try {
            this.settings.updateFromUI(this.settingsData);
            this.settingsData.currentPage = this.pagesData.length > 0 ? this.pagesData[0].id : 1;

            const duplicateUrls = this.findDuplicateBookmarkUrls(this.bookmarksData);

            await this.data.saveBookmarks(this.bookmarksData, this.currentPageId);
            await this.data.saveFinders(this.findersData);
            
            if (this.currentCategoriesPageId) {
                const categoriesForSelectedPage = this.getCategoriesFromDOM();
                if (categoriesForSelectedPage && categoriesForSelectedPage.length >= 0) {
                    await this.data.saveCategoriesByPage(categoriesForSelectedPage, this.currentCategoriesPageId);
                }
            }
            
            await this.data.savePages(this.pagesData);
            
            if (this.deviceSpecific) {
                // Don't save global settings in localStorage
                const settingsToSave = { ...this.settingsData };
                delete settingsToSave.enableCustomFavicon;
                delete settingsToSave.customFaviconPath;
                delete settingsToSave.enableCustomFont;
                delete settingsToSave.customFontPath;
                this.storage.saveDeviceSettings(settingsToSave);
            } else {
                await this.data.saveSettings(this.settingsData);
            }

            this.originalPagesData = JSON.parse(JSON.stringify(this.pagesData));
            this.signalDashboardSettingsUpdated('settings-saved');
            if (duplicateUrls.length > 0) {
                this.ui.showNotification('Configuration saved. Duplicate bookmark URLs detected.', 'warning');
            } else {
                this.ui.showNotification(this.language.t('config.configSaved'), 'success');
            }
            this.clearDirty();
            this.undoSnapshot = null;
            this.savedSnapshot = this.captureUndoSnapshot();
            this.setDirtyState(false);
            this.refreshSmartCollectionCounters();
            try {
                const allBookmarksResponse = await fetch('/api/bookmarks?all=true');
                this.allBookmarksData = allBookmarksResponse.ok ? await allBookmarksResponse.json() : [];
            } catch (error) {
                // keep previous cache
            }
            if (this.stats && window.location.hash === '#stats') {
                this.stats.refresh(this);
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            if (saveStatus) {
                saveStatus.textContent = 'Save failed';
                saveStatus.classList.add('is-unsaved');
            }
            const message = String(error?.message || '');
            if (message.toLowerCase().includes('duplicate shortcut')) {
                this.ui.showNotification(message, 'error');
            } else {
                this.ui.showNotification(this.language.t('config.errorSavingConfig'), 'error');
            }
        }
    }

    warnDuplicateUrl(url) {
        const normalized = (url || '').trim().toLowerCase();
        if (!normalized) return;

        const duplicate = this.bookmarksData.some((bookmark, index) => {
            if (index === this.bookmarksData.length - 1) return false;
            return (bookmark.url || '').trim().toLowerCase() === normalized;
        });

        if (duplicate) {
            this.ui.showNotification('Duplicate URL detected for the new bookmark.', 'warning');
        }
    }

    findDuplicateBookmarkUrls(bookmarks) {
        const seen = new Set();
        const duplicates = new Set();

        bookmarks.forEach((bookmark) => {
            const url = (bookmark.url || '').trim().toLowerCase();
            if (!url) {
                return;
            }

            if (seen.has(url)) {
                duplicates.add(url);
            } else {
                seen.add(url);
            }
        });

        return Array.from(duplicates);
    }

    getDuplicateFinderShortcutSet() {
        const finderShortcuts = (Array.isArray(this.findersData) ? this.findersData : [])
            .map((finder) => String(finder?.shortcut || '').trim().toUpperCase())
            .filter(Boolean);
        const counts = new Map();
        finderShortcuts.forEach((shortcut) => {
            counts.set(shortcut, (counts.get(shortcut) || 0) + 1);
        });
        return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([shortcut]) => shortcut));
    }

    validateBookmarkConflicts(options = {}) {
        const urlMap = new Map();
        const shortcutMap = new Map();
        const normalizedUrlByIndex = new Map();
        const normalizedShortcutByIndex = new Map();

        this.bookmarksData.forEach((bookmark, index) => {
            const normalizedUrl = (bookmark?.url || '').trim().toLowerCase();
            const normalizedShortcut = (bookmark?.shortcut || '').trim().toUpperCase();
            normalizedUrlByIndex.set(index, normalizedUrl);
            normalizedShortcutByIndex.set(index, normalizedShortcut);

            if (normalizedUrl) {
                const list = urlMap.get(normalizedUrl) || [];
                list.push(index);
                urlMap.set(normalizedUrl, list);
            }
            if (normalizedShortcut) {
                const list = shortcutMap.get(normalizedShortcut) || [];
                list.push(index);
                shortcutMap.set(normalizedShortcut, list);
            }
        });

        const duplicateUrlIndexes = new Set();
        const duplicateShortcutIndexes = new Set();
        const finderConflictIndexes = new Set();
        const globalDuplicateShortcutIndexes = new Set();
        urlMap.forEach((indexes) => {
            if (indexes.length > 1) {
                indexes.forEach((idx) => duplicateUrlIndexes.add(idx));
            }
        });
        shortcutMap.forEach((indexes) => {
            if (indexes.length > 1) {
                indexes.forEach((idx) => duplicateShortcutIndexes.add(idx));
            }
        });

        // Check shortcut conflicts against bookmarks from other pages.
        const localShortcutCount = new Map();
        normalizedShortcutByIndex.forEach((shortcut) => {
            if (!shortcut) return;
            localShortcutCount.set(shortcut, (localShortcutCount.get(shortcut) || 0) + 1);
        });
        const globalShortcutCount = new Map();
        (Array.isArray(this.allBookmarksData) ? this.allBookmarksData : []).forEach((bookmark) => {
            const shortcut = (bookmark?.shortcut || '').trim().toUpperCase();
            if (!shortcut) return;
            globalShortcutCount.set(shortcut, (globalShortcutCount.get(shortcut) || 0) + 1);
        });
        normalizedShortcutByIndex.forEach((shortcut, index) => {
            if (!shortcut) return;
            const globalCount = globalShortcutCount.get(shortcut) || 0;
            const localCount = localShortcutCount.get(shortcut) || 0;
            if (globalCount > localCount) {
                globalDuplicateShortcutIndexes.add(index);
            }
        });

        // Finder shortcut conflicts are warnings (non-blocking).
        const finderShortcutSet = new Set(
            (Array.isArray(this.findersData) ? this.findersData : [])
                .map((finder) => String(finder?.shortcut || '').trim().toUpperCase())
                .filter(Boolean)
        );
        normalizedShortcutByIndex.forEach((shortcut, index) => {
            if (shortcut && finderShortcutSet.has(shortcut)) {
                finderConflictIndexes.add(index);
            }
        });

        this.bookmarksData.forEach((_, index) => {
            const urlInput = document.getElementById(`bookmark-url-${index}`);
            const shortcutInput = document.getElementById(`bookmark-shortcut-${index}`);
            if (urlInput) {
                urlInput.classList.toggle('field-conflict', duplicateUrlIndexes.has(index));
            }
            if (shortcutInput) {
                const hasBlockingShortcutConflict = duplicateShortcutIndexes.has(index) || globalDuplicateShortcutIndexes.has(index);
                shortcutInput.classList.toggle('field-conflict', hasBlockingShortcutConflict);
                const hasFinderWarning = finderConflictIndexes.has(index);
                shortcutInput.classList.toggle('field-warning', hasFinderWarning && !hasBlockingShortcutConflict);
                if (hasBlockingShortcutConflict) {
                    shortcutInput.title = 'Shortcut must be unique across all bookmarks.';
                } else if (hasFinderWarning) {
                    shortcutInput.title = 'Shortcut matches a finder shortcut.';
                } else {
                    shortcutInput.removeAttribute('title');
                }
            }
        });

        const hasConflicts = duplicateUrlIndexes.size > 0 || duplicateShortcutIndexes.size > 0 || globalDuplicateShortcutIndexes.size > 0;
        if (hasConflicts && options.showToast) {
            this.ui.showNotification(
                `Fix conflicts first: ${duplicateUrlIndexes.size} duplicate URL(s), ${duplicateShortcutIndexes.size + globalDuplicateShortcutIndexes.size} duplicate shortcut(s).`,
                'warning'
            );
        }
        if (!hasConflicts && finderConflictIndexes.size > 0 && options.showToast) {
            const duplicateFinderShortcuts = this.getDuplicateFinderShortcutSet();
            const severity = duplicateFinderShortcuts.size > 0 ? 'warning' : 'info';
            this.ui.showNotification(
                `Shortcut warning: ${finderConflictIndexes.size} bookmark shortcut(s) overlap with finder shortcuts.`,
                severity
            );
        }

        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.disabled = hasConflicts;
        }

        return {
            hasConflicts,
            duplicateUrlCount: duplicateUrlIndexes.size,
            duplicateShortcutCount: duplicateShortcutIndexes.size + globalDuplicateShortcutIndexes.size,
            finderShortcutConflictCount: finderConflictIndexes.size
        };
    }

    async resetToDefaults() {
        const confirmed = await window.AppModal.danger({
            title: this.language.t('config.resetSettingsTitle'),
            message: this.language.t('config.resetSettingsMessage'),
            confirmText: this.language.t('config.reset'),
            cancelText: this.language.t('config.cancel')
        });
        
        if (!confirmed) return;
        const undoSnapshot = this.captureUndoSnapshot();
        this.bookmarksData = [
            { name: 'GitHub', url: 'https://github.com', shortcut: 'G', category: 'development' },
            { name: 'GitHub Issues', url: 'https://github.com/issues', shortcut: 'GI', category: 'development' },
            { name: 'GitHub Pull Requests', url: 'https://github.com/pulls', shortcut: 'GP', category: 'development' },
            { name: 'YouTube', url: 'https://youtube.com', shortcut: 'Y', category: 'media' },
            { name: 'YouTube Studio', url: 'https://studio.youtube.com', shortcut: 'YS', category: 'media' },
            { name: 'Twitter', url: 'https://twitter.com', shortcut: 'T', category: 'social' },
            { name: 'TikTok', url: 'https://tiktok.com', shortcut: 'TT', category: 'social' },
            { name: 'Google', url: 'https://google.com', shortcut: '', category: 'search' }
        ];

        this.categoriesData = [
            { id: 'development', name: 'Development' },
            { id: 'media', name: 'Media' },
            { id: 'social', name: 'Social' },
            { id: 'search', name: 'Search' },
            { id: 'utilities', name: 'Utilities' }
        ];

        const defaultSettings = this.settings.getDefaults();
        Object.assign(this.settingsData, defaultSettings);
        document.getElementById('theme-select').value = this.settingsData.theme;
        document.getElementById('columns-input').value = this.settingsData.columnsPerRow;
        document.getElementById('font-size-select').value = this.settingsData.fontSize;
        document.getElementById('new-tab-checkbox').checked = this.settingsData.openInNewTab;
        document.getElementById('show-background-dots-checkbox').checked = this.settingsData.showBackgroundDots;
        document.getElementById('show-title-checkbox').checked = this.settingsData.showTitle;
        document.getElementById('show-date-checkbox').checked = this.settingsData.showDate;
        document.getElementById('show-config-button-checkbox').checked = this.settingsData.showConfigButton;
        document.getElementById('show-search-button-checkbox').checked = this.settingsData.showSearchButton;
        document.getElementById('show-finders-button-checkbox').checked = this.settingsData.showFindersButton;
        document.getElementById('show-commands-button-checkbox').checked = this.settingsData.showCommandsButton;
        document.getElementById('show-cheatsheet-button-checkbox').checked = this.settingsData.showCheatSheetButton;
        const showTipsCheckbox = document.getElementById('show-tips-checkbox');
        if (showTipsCheckbox) showTipsCheckbox.checked = this.settingsData.showTips !== false;
        const showSyncToastsCheckbox = document.getElementById('show-sync-toasts-checkbox');
        if (showSyncToastsCheckbox) showSyncToastsCheckbox.checked = this.settingsData.showSyncToasts !== false;
        document.getElementById('show-search-button-text-checkbox').checked = this.settingsData.showSearchButtonText;
        document.getElementById('show-finders-button-text-checkbox').checked = this.settingsData.showFindersButtonText;
        document.getElementById('show-commands-button-text-checkbox').checked = this.settingsData.showCommandsButtonText;
        document.getElementById('include-finders-in-search-checkbox').checked = this.settingsData.includeFindersInSearch;
        document.getElementById('interleave-mode-checkbox').checked = false;
        document.getElementById('show-page-tabs-checkbox').checked = this.settingsData.showPageTabs;
        const smartRecentCheckbox = document.getElementById('show-smart-recent-collection-checkbox');
        if (smartRecentCheckbox) smartRecentCheckbox.checked = this.settingsData.showSmartRecentCollection;
        const smartStaleCheckbox = document.getElementById('show-smart-stale-collection-checkbox');
        if (smartStaleCheckbox) smartStaleCheckbox.checked = this.settingsData.showSmartStaleCollection;
        const smartMostUsedCheckbox = document.getElementById('show-smart-most-used-collection-checkbox');
        if (smartMostUsedCheckbox) smartMostUsedCheckbox.checked = this.settingsData.showSmartMostUsedCollection === true;
        const smartRecentInput = document.getElementById('smart-recent-pages-input');
        if (smartRecentInput) smartRecentInput.value = '';
        const smartStaleInput = document.getElementById('smart-stale-pages-input');
        if (smartStaleInput) smartStaleInput.value = '';
        document.getElementById('always-collapse-categories-checkbox').checked = this.settingsData.alwaysCollapseCategories;

        this.setupDOM();
        this.settings.applyTheme(this.settingsData.theme);
        if (this.settings && typeof this.settings.reloadThemeCSS === 'function') {
            this.settings.reloadThemeCSS();
        }
        this.renderConfig();
        this.initReordering();
        this.showUndoNotification('Settings reset to defaults.', undoSnapshot);
        this.markDirty();
    }

    generateId(text) {
        return text.toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
}

let configManager;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => configManager = new ConfigManager());
} else {
    configManager = new ConfigManager();
}
