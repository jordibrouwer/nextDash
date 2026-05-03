/**
 * Settings Module
 * Handles settings UI and configuration
 */

class ConfigSettings {
    constructor(language) {
        this.language = language;
        this.t = language.t.bind(language); // Translation function
        this.customThemes = {}; // Store selectable themes (id -> display name)
        this.legacyThemeMap = {
            aurora: 'midnight-neon-dark',
            cyberpunk: 'retro-crt-dark',
            ember: 'solar-ember-dark',
            forest: 'forest-moss-dark',
            lavender: 'lavender-mist-dark',
            matcha: 'forest-moss-dark',
            midnight: 'midnight-neon-dark',
            mint: 'nordic-frost-light',
            nerd: 'retro-crt-dark',
            ocean: 'ocean-depth-dark',
            paper: 'paper-ink-light',
            peach: 'desert-sand-light',
            sunset: 'solar-ember-light',
            synthwave: 'cherry-graphite-dark',
            void: 'paper-ink-dark'
        };
    }

    normalizeThemeId(themeId) {
        if (!themeId) return 'dark';

        const normalized = this.legacyThemeMap[themeId] || themeId;
        if (normalized === 'light' || normalized === 'dark') {
            return normalized;
        }

        const themeIds = Object.keys(this.customThemes || {});
        if (themeIds.includes(normalized)) {
            return normalized;
        }

        // Allow built-in theme families before the async theme list is loaded.
        if (/-((dark)|(light))$/.test(normalized)) {
            return normalized;
        }

        return 'dark';
    }

    getThemeDisplayName(themeId, value) {
        if (themeId === 'dark') {
            return 'Old Default [dark]';
        }
        if (themeId === 'light') {
            return 'Old Default [light]';
        }
        if (value && typeof value === 'object' && value.name) {
            return String(value.name);
        }
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
        return String(themeId || this.t('config.unnamedTheme') || 'Theme');
    }

    getPairedThemeVariant(themeId, wantsDark) {
        const normalized = this.normalizeThemeId(themeId);
        if (normalized === 'dark' || normalized === 'light') {
            return wantsDark ? 'dark' : 'light';
        }
        const match = normalized.match(/^(.*)-(dark|light)$/);
        if (!match) {
            return wantsDark ? 'dark' : 'light';
        }
        const pairCandidate = `${match[1]}-${wantsDark ? 'dark' : 'light'}`;
        const hasPair = Object.prototype.hasOwnProperty.call(this.customThemes || {}, pairCandidate);
        return hasPair ? pairCandidate : normalized;
    }

    bindInfoButton(buttonId, titleKey, messageKey) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (!window.AppModal) return;
            window.AppModal.alert({
                title: this.t(titleKey),
                htmlMessage: this.t(messageKey).replace(/\n/g, '<br>'),
                confirmText: this.t('config.gotIt')
            });
        });
    }

    updateLayoutDensityPreview(layoutPreset, densityMode) {
        const layoutMap = {
            default: {
                description: 'Balanced spacing and single-line bookmark rows.',
                label: 'Default'
            },
            compact: {
                description: 'Reduced gaps and padding for tighter columns.',
                label: 'Compact'
            },
            cards: {
                description: 'Card containers with room for two-line bookmark titles.',
                label: 'Cards'
            },
            terminal: {
                description: 'Monospace, single-line rows with terminal style cues.',
                label: 'Terminal-ish'
            }
        };
        const densityMap = {
            comfortable: {
                description: 'Larger row height and calmer spacing.',
                label: 'Comfortable'
            },
            compact: {
                description: 'Compact rows with balanced readability and information density.',
                label: 'Compact'
            },
            dense: {
                description: 'Most efficient row height for high bookmark counts.',
                label: 'Dense'
            }
        };

        const layoutMeta = layoutMap[layoutPreset] || layoutMap.default;
        const densityMeta = densityMap[densityMode] || densityMap.compact;
        const layoutDescription = document.getElementById('layout-preset-description');
        const densityDescription = document.getElementById('density-mode-description');
        const previewText = document.getElementById('layout-density-preview-text');

        if (layoutDescription) {
            layoutDescription.textContent = layoutMeta.description;
        }
        if (densityDescription) {
            densityDescription.textContent = densityMeta.description;
        }
        if (previewText) {
            previewText.textContent = `${layoutMeta.label} + ${densityMeta.label}: ${layoutMeta.description.toLowerCase()}`;
        }
    }

    formatPageIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) {
            return '';
        }
        return ids.join(', ');
    }

    parsePageIds(value) {
        if (!value || !value.trim()) {
            return [];
        }
        const unique = new Set();
        value.split(',').forEach((part) => {
            const parsed = parseInt(part.trim(), 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
                unique.add(parsed);
            }
        });
        return Array.from(unique).sort((a, b) => a - b);
    }

    getSelectedPageIds(selectElement) {
        if (!selectElement) {
            return [];
        }
        return Array.from(selectElement.selectedOptions || [])
            .map((option) => Number(option.value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .sort((a, b) => a - b);
    }

    populateSmartPageSelector(selectElement, pages, selectedPageIds) {
        if (!selectElement) {
            return;
        }

        const selected = new Set(
            (Array.isArray(selectedPageIds) ? selectedPageIds : [])
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value) && value > 0)
        );

        selectElement.innerHTML = '';
        (Array.isArray(pages) ? pages : []).forEach((page, index) => {
            const pageId = Number(page.id);
            if (!Number.isFinite(pageId) || pageId <= 0) {
                return;
            }

            const option = document.createElement('option');
            option.value = String(pageId);
            option.textContent = `${index + 1}. ${page.name || `${this.t('config.pagePrefix')} ${index + 1}`}`;
            option.selected = selected.has(pageId);
            selectElement.appendChild(option);
        });
    }

    populateSmartPageSelectors(pages, settings) {
        this.populateSmartPageSelector(
            document.getElementById('smart-recent-pages-select'),
            pages,
            settings?.smartRecentPageIds || []
        );
        this.populateSmartPageSelector(
            document.getElementById('smart-stale-pages-select'),
            pages,
            settings?.smartStalePageIds || []
        );
        this.populateSmartPageSelector(
            document.getElementById('smart-most-used-pages-select'),
            pages,
            settings?.smartMostUsedPageIds || []
        );
    }

    toggleSmartCollectionControls(type, enabled) {
        const map = {
            recent: ['smart-recent-pages-select', 'smart-recent-limit-select'],
            stale: ['smart-stale-pages-select', 'smart-stale-limit-select'],
            mostUsed: ['smart-most-used-pages-select', 'smart-most-used-limit-select']
        };
        (map[type] || []).forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = !enabled;
            const row = el.closest('.checkbox-tree-child');
            if (row) {
                row.classList.toggle('is-disabled', !enabled);
            }
        });
    }

    async loadCustomThemes() {
        try {
            const response = await fetch('/api/colors/custom-themes');
            if (response.ok) {
                this.customThemes = await response.json();
                window.CustomThemeIds = Array.isArray(this.customThemes)
                    ? this.customThemes
                    : Object.keys(this.customThemes || {});
            } else {
                this.customThemes = {};
                window.CustomThemeIds = [];
            }
        } catch (error) {
            console.error('Error loading custom themes:', error);
            this.customThemes = {};
            window.CustomThemeIds = [];
        }
    }

    populateThemeSelect() {
        const themeSelect = document.getElementById('theme-select');
        if (!themeSelect) return;

        const currentValue = themeSelect.value;

        const allThemes = {
            dark: this.t('dashboard.darkTheme') || 'Dark',
            light: this.t('dashboard.lightTheme') || 'Light',
            ...(this.customThemes || {})
        };
        const sortedThemes = Object.entries(allThemes).sort(([idA, valueA], [idB, valueB]) => {
            const labelA = this.getThemeDisplayName(idA, valueA);
            const labelB = this.getThemeDisplayName(idB, valueB);
            return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
        });

        themeSelect.innerHTML = '';
        sortedThemes.forEach(([themeId, themeValue]) => {
            const option = document.createElement('option');
            option.value = themeId;
            option.textContent = this.getThemeDisplayName(themeId, themeValue);
            themeSelect.appendChild(option);
        });

        if (currentValue) {
            themeSelect.value = currentValue;
        }
    }

    /**
     * Setup event listeners for all settings controls
     * @param {Object} settings - Reference to settings object
     * @param {Function} callbacks - Object with callback functions
     */
    async setupListeners(settings, callbacks) {
        await this.loadCustomThemes();
        this.populateThemeSelect();
        
        // Language select
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            this.language.setupLanguageSelector();
            languageSelect.addEventListener('change', async (e) => {
                const newLang = e.target.value;
                settings.language = newLang;
                await this.language.loadTranslations(newLang);
                await this.saveSettingsToServer(settings);
            });
        }
        
        // Theme select
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            const preferredTheme = this.normalizeThemeId(settings.theme || 'dark');
            const hasPreferredTheme = Array.from(themeSelect.options).some(option => option.value === preferredTheme);
            themeSelect.value = hasPreferredTheme ? preferredTheme : 'dark';
            settings.theme = themeSelect.value;
            themeSelect.addEventListener('change', (e) => {
                settings.theme = e.target.value;
                if (callbacks.onThemeChange) callbacks.onThemeChange(settings.theme);
                this.reloadThemeCSS();
            });
        }

        // Columns input
        const columnsInput = document.getElementById('columns-input');
        if (columnsInput) {
            columnsInput.value = settings.columnsPerRow;
            columnsInput.addEventListener('input', (e) => {
                settings.columnsPerRow = parseInt(e.target.value);
            });
        }

        const sortMethodSelect = document.getElementById('sort-method-select');
        if (sortMethodSelect) {
            sortMethodSelect.value = settings.sortMethod || 'order';
            sortMethodSelect.addEventListener('change', (e) => {
                settings.sortMethod = e.target.value;
            });
        }

        const layoutPresetSelect = document.getElementById('layout-preset-select');
        if (layoutPresetSelect) {
            if (window.LayoutUtils) {
                const presets = window.LayoutUtils.getLayoutPresets();
                const LABEL_MAP = {
                    terminal: 'Terminal-ish',
                    masonry: 'Masonry',
                    list: 'List (detailed)',
                    widgets: 'Widgets / Modules',
                    compact: 'Compact',
                    cards: 'Cards',
                    default: 'Default'
                };
                layoutPresetSelect.innerHTML = presets.map((preset) => {
                    const label = LABEL_MAP[preset] || (preset.charAt(0).toUpperCase() + preset.slice(1));
                    return `<option value="${preset}">${label}</option>`;
                }).join('');
                settings.layoutPreset = window.LayoutUtils.normalizeLayoutPreset(settings.layoutPreset || 'default');
            }
            layoutPresetSelect.value = settings.layoutPreset || 'default';
            if (callbacks.onLayoutPresetChange) {
                callbacks.onLayoutPresetChange(layoutPresetSelect.value);
            }
            this.updateLayoutDensityPreview(settings.layoutPreset || 'default', settings.densityMode || 'compact');
            layoutPresetSelect.addEventListener('change', (e) => {
                settings.layoutPreset = window.LayoutUtils
                    ? window.LayoutUtils.normalizeLayoutPreset(e.target.value)
                    : e.target.value;
                if (callbacks.onLayoutPresetChange) callbacks.onLayoutPresetChange(settings.layoutPreset);
                this.updateLayoutDensityPreview(settings.layoutPreset, settings.densityMode || 'compact');
            });
        }

        const densityModeSelect = document.getElementById('density-mode-select');
        if (densityModeSelect) {
            const DENSITIES = ['comfortable', 'compact', 'dense', 'auto'];
            const DENSITY_LABELS = {
                comfortable: 'Comfortable',
                compact: 'Compact',
                dense: 'Dense',
                auto: 'Auto (adaptive)'
            };
            densityModeSelect.innerHTML = DENSITIES.map(d => `<option value="${d}">${DENSITY_LABELS[d] || d}</option>`).join('');

            const normalizedDensity = DENSITIES.includes(settings.densityMode) ? settings.densityMode : 'compact';
            settings.densityMode = normalizedDensity;
            densityModeSelect.value = normalizedDensity;
            this.updateLayoutDensityPreview(settings.layoutPreset || 'default', normalizedDensity);

            densityModeSelect.addEventListener('change', (e) => {
                const value = DENSITIES.includes(e.target.value) ? e.target.value : 'compact';
                settings.densityMode = value;
                if (callbacks.onDensityModeChange) callbacks.onDensityModeChange(value);
                this.updateLayoutDensityPreview(settings.layoutPreset || 'default', value);
            });
        }

        const packedColumnsCheckbox = document.getElementById('packed-columns-checkbox');
        if (packedColumnsCheckbox) {
            packedColumnsCheckbox.checked = settings.packedColumns === true;
            packedColumnsCheckbox.addEventListener('change', async (e) => {
                settings.packedColumns = e.target.checked;
                if (callbacks.onPackedColumnsChange) {
                    await callbacks.onPackedColumnsChange(settings.packedColumns === true);
                }
            });
        }

        const autoDarkModeCheckbox = document.getElementById('auto-dark-mode-checkbox');
        if (autoDarkModeCheckbox) {
            autoDarkModeCheckbox.checked = settings.autoDarkMode === true;
            autoDarkModeCheckbox.addEventListener('change', (e) => {
                settings.autoDarkMode = e.target.checked;
                if (callbacks.onAutoDarkModeChange) callbacks.onAutoDarkModeChange(settings.autoDarkMode);
            });
        }

        const backgroundOpacityInput = document.getElementById('background-opacity-input');
        const backgroundOpacityValue = document.getElementById('background-opacity-value');
        if (backgroundOpacityInput) {
            const initialOpacity = Number(settings.backgroundOpacity ?? 1);
            backgroundOpacityInput.value = String(initialOpacity);
            const setOpacitySliderFill = (value) => {
                const min = Number(backgroundOpacityInput.min || 0.65);
                const max = Number(backgroundOpacityInput.max || 1);
                const clamped = Math.min(max, Math.max(min, Number(value)));
                const ratio = max > min ? ((clamped - min) / (max - min)) : 1;
                backgroundOpacityInput.style.setProperty('--slider-fill', `${Math.round(ratio * 100)}%`);
            };
            setOpacitySliderFill(initialOpacity);
            if (backgroundOpacityValue) {
                backgroundOpacityValue.textContent = `${Math.round(initialOpacity * 100)}%`;
            }
            backgroundOpacityInput.addEventListener('input', (e) => {
                const value = Number(e.target.value);
                settings.backgroundOpacity = value;
                setOpacitySliderFill(value);
                if (backgroundOpacityValue) {
                    backgroundOpacityValue.textContent = `${Math.round(value * 100)}%`;
                }
                if (callbacks.onBackgroundOpacityChange) callbacks.onBackgroundOpacityChange(value);
            });
        }

        const fontWeightSelect = document.getElementById('font-weight-select');
        if (fontWeightSelect) {
            fontWeightSelect.value = settings.fontWeight || 'normal';
            fontWeightSelect.addEventListener('change', (e) => {
                settings.fontWeight = e.target.value;
                if (callbacks.onFontWeightChange) callbacks.onFontWeightChange(settings.fontWeight);
            });
        }

        const fontPresetSelect = document.getElementById('font-preset-select');
        if (fontPresetSelect && window.DashboardFont) {
            const normalized = window.DashboardFont.normalizePresetId(settings.fontPreset);
            settings.fontPreset = normalized;
            fontPresetSelect.value = normalized;
            fontPresetSelect.disabled = !!settings.enableCustomFont;
            fontPresetSelect.addEventListener('change', (e) => {
                const v = window.DashboardFont.normalizePresetId(e.target.value);
                settings.fontPreset = v;
                fontPresetSelect.value = v;
                if (callbacks.onFontPresetChange) callbacks.onFontPresetChange(v);
            });
        }

        // Font size selector buttons
        const fontSizeOptions = document.querySelectorAll('.font-size-option');

        if (fontSizeOptions.length > 0) {
            // Normalize legacy alias values (if any) to current map
            const aliasMap = {
                small: 'sm',
                medium: 'm',
                large: 'l'
            };

            let fontSizeValue = settings.fontSize;
            if (fontSizeValue && aliasMap[fontSizeValue]) {
                fontSizeValue = aliasMap[fontSizeValue];
            }

            // Set initial active button
            const initialSize = fontSizeValue || 'm';
            fontSizeOptions.forEach(btn => {
                if (btn.dataset.size === initialSize) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Ensure the current font size is applied immediately
            settings.fontSize = initialSize;
            if (callbacks.onFontSizeChange) callbacks.onFontSizeChange(settings.fontSize);

            // Listen for changes
            fontSizeOptions.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const fontSize = e.target.dataset.size;
                    settings.fontSize = fontSize;

                    // Update active state
                    fontSizeOptions.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');

                    if (callbacks.onFontSizeChange) callbacks.onFontSizeChange(settings.fontSize);
                });
            });
        }

        // New tab checkbox
        const newTabCheckbox = document.getElementById('new-tab-checkbox');
        if (newTabCheckbox) {
            newTabCheckbox.checked = settings.openInNewTab;
            newTabCheckbox.addEventListener('change', (e) => {
                settings.openInNewTab = e.target.checked;
            });
        }

        // HyprMode checkbox
        const hyprModeCheckbox = document.getElementById('hypr-mode-checkbox');
        if (hyprModeCheckbox) {
            hyprModeCheckbox.checked = settings.hyprMode || false;
            hyprModeCheckbox.addEventListener('change', (e) => {
                settings.hyprMode = e.target.checked;
                // Disable preview if callback is provided
                if (callbacks.onHyprModeChange) callbacks.onHyprModeChange(settings.hyprMode);
            });
        }

        this.bindInfoButton('hypr-mode-info-btn', 'config.hyprModeInfoTitle', 'config.hyprModeInfoMessage');
        this.bindInfoButton('interleave-mode-info-btn', 'config.interleaveModeInfoTitle', 'config.interleaveModeInfoMessage');
        this.bindInfoButton('fuzzy-suggestions-info-btn', 'config.fuzzySuggestionsInfoTitle', 'config.fuzzySuggestionsInfoMessage');
        this.bindInfoButton('include-finders-in-search-info-btn', 'config.includeFindersInSearchInfoTitle', 'config.includeFindersInSearchInfoMessage');
        this.bindInfoButton('packed-columns-info-btn', 'config.packedColumnsInfoTitle', 'config.packedColumnsInfoMessage');
        this.bindInfoButton('show-page-names-in-tabs-info-btn', 'config.showPageNamesInTabsInfoTitle', 'config.showPageNamesInTabsInfoMessage');
        this.bindInfoButton('show-page-tabs-info-btn', 'config.showPageTabsInfoTitle', 'config.showPageTabsInfoMessage');
        this.bindInfoButton('always-collapse-categories-info-btn', 'config.alwaysCollapseCategoriesInfoTitle', 'config.alwaysCollapseCategoriesInfoMessage');
        this.bindInfoButton('global-shortcuts-info-btn', 'config.globalShortcutsInfoTitle', 'config.globalShortcutsInfoMessage');
        this.bindInfoButton('show-tips-info-btn', 'config.showTipsInfoTitle', 'config.showTipsInfoMessage');
        this.bindInfoButton('keep-search-open-when-empty-info-btn', 'config.keepSearchOpenWhenEmptyInfoTitle', 'config.keepSearchOpenWhenEmptyInfoMessage');
        this.bindInfoButton('show-status-info-btn', 'config.showBookmarkStatusInfoTitle', 'config.showBookmarkStatusInfoMessage');
        this.bindInfoButton('skip-fast-ping-info-btn', 'config.skipFastPingInfoTitle', 'config.skipFastPingInfoMessage');
        this.bindInfoButton('show-sync-toasts-info-btn', 'config.showSyncToastsInfoTitle', 'config.showSyncToastsInfoMessage');

        // Show background dots checkbox
        const showBackgroundDotsCheckbox = document.getElementById('show-background-dots-checkbox');
        if (showBackgroundDotsCheckbox) {
            showBackgroundDotsCheckbox.checked = settings.showBackgroundDots !== false;
            showBackgroundDotsCheckbox.addEventListener('change', (e) => {
                settings.showBackgroundDots = e.target.checked;
                if (callbacks.onBackgroundDotsChange) callbacks.onBackgroundDotsChange(e.target.checked);
            });
        }

        // Show icons checkbox
        const showIconsCheckbox = document.getElementById('show-icons-checkbox');
        if (showIconsCheckbox) {
            showIconsCheckbox.checked = settings.showIcons !== false;
            showIconsCheckbox.addEventListener('change', (e) => {
                settings.showIcons = e.target.checked;
            });
        }

        const showShortcutsCheckbox = document.getElementById('show-shortcuts-checkbox');
        if (showShortcutsCheckbox) {
            showShortcutsCheckbox.checked = settings.showShortcuts !== false;
            showShortcutsCheckbox.addEventListener('change', (e) => {
                settings.showShortcuts = e.target.checked;
            });
        }

        const showPinIconCheckbox = document.getElementById('show-pin-icon-checkbox');
        if (showPinIconCheckbox) {
            showPinIconCheckbox.checked = settings.showPinIcon === true;
            showPinIconCheckbox.addEventListener('change', (e) => {
                settings.showPinIcon = e.target.checked;
            });
        }

        // Show title checkbox
        const showTitleCheckbox = document.getElementById('show-title-checkbox');
        if (showTitleCheckbox) {
            showTitleCheckbox.checked = settings.showTitle;
            showTitleCheckbox.addEventListener('change', (e) => {
                settings.showTitle = e.target.checked;
            });
        }

        // Enable custom title checkbox
        const enableCustomTitleCheckbox = document.getElementById('enable-custom-title-checkbox');
        if (enableCustomTitleCheckbox) {
            enableCustomTitleCheckbox.checked = settings.enableCustomTitle;
            enableCustomTitleCheckbox.addEventListener('change', (e) => {
                settings.enableCustomTitle = e.target.checked;
                this.toggleCustomTitleInput(e.target.checked);
            });
        }

        // Custom title input
        const customTitleInput = document.getElementById('custom-title-input');
        if (customTitleInput) {
            customTitleInput.value = settings.customTitle || '';
            customTitleInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                settings.customTitle = value;
                
                // Auto-enable checkbox when user starts typing (only if not already enabled)
                if (value && !settings.enableCustomTitle) {
                    settings.enableCustomTitle = true;
                    const checkbox = document.getElementById('enable-custom-title-checkbox');
                    if (checkbox) checkbox.checked = true;
                    this.toggleCustomTitleInput(true);
                }
            });
            // Initial visibility
            this.toggleCustomTitleInput(settings.enableCustomTitle);
        }

        // Enable custom favicon checkbox
        const enableCustomFaviconCheckbox = document.getElementById('enable-custom-favicon-checkbox');
        if (enableCustomFaviconCheckbox) {
            enableCustomFaviconCheckbox.checked = settings.enableCustomFavicon;
            enableCustomFaviconCheckbox.addEventListener('change', async (e) => {
                settings.enableCustomFavicon = e.target.checked;
                this.toggleCustomFaviconInput(e.target.checked);
                // Always save to server regardless of device-specific settings
                await this.saveSettingsToServer(settings);
            });
        }

        // Custom favicon input
        const customFaviconInput = document.getElementById('custom-favicon-input');
        if (customFaviconInput) {
            customFaviconInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const formData = new FormData();
                    formData.append('favicon', file);

                    try {
                        const response = await fetch('/api/favicon', {
                            method: 'POST',
                            body: formData
                        });

                        if (response.ok) {
                            const result = await response.json();
                            settings.customFaviconPath = result.path;
                            // Auto-enable checkbox when user uploads a file
                            if (!settings.enableCustomFavicon) {
                                settings.enableCustomFavicon = true;
                                const checkbox = document.getElementById('enable-custom-favicon-checkbox');
                                if (checkbox) checkbox.checked = true;
                                this.toggleCustomFaviconInput(true);
                            }
                            // Always save to server regardless of device-specific settings
                            await this.saveSettingsToServer(settings);
                        } else {
                            console.error('Failed to upload favicon');
                        }
                    } catch (error) {
                        console.error('Error uploading favicon:', error);
                    }
                }
            });
            // Initial visibility
            this.toggleCustomFaviconInput(settings.enableCustomFavicon);
        }

        // Enable custom font checkbox
        const enableCustomFontCheckbox = document.getElementById('enable-custom-font-checkbox');
        if (enableCustomFontCheckbox) {
            enableCustomFontCheckbox.checked = settings.enableCustomFont;
            enableCustomFontCheckbox.addEventListener('change', async (e) => {
                settings.enableCustomFont = e.target.checked;
                this.toggleCustomFontInput(e.target.checked);
                const presetSel = document.getElementById('font-preset-select');
                if (presetSel) presetSel.disabled = e.target.checked;
                if (e.target.checked && settings.customFontPath) {
                    // Apply the font if enabled and path exists
                    if (window.ConfigFont) {
                        window.ConfigFont.applyFont(settings.customFontPath);
                    }
                } else if (!e.target.checked) {
                    // Reset to default font
                    if (window.ConfigFont) {
                        window.ConfigFont.resetFont();
                    }
                    if (presetSel) presetSel.disabled = false;
                }
                await this.saveSettingsToServer(settings);
            });
        }

        // Custom font input
        const customFontInput = document.getElementById('custom-font-input');
        if (customFontInput) {
            customFontInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const result = await window.ConfigFont.uploadFont(file);
                        settings.customFontPath = result;
                        // Auto-enable checkbox when user uploads a file
                        if (!settings.enableCustomFont) {
                            settings.enableCustomFont = true;
                            const checkbox = document.getElementById('enable-custom-font-checkbox');
                            if (checkbox) checkbox.checked = true;
                            this.toggleCustomFontInput(true);
                        }
                        // Apply the font immediately
                        window.ConfigFont.applyFont(settings.customFontPath);
                        const ps = document.getElementById('font-preset-select');
                        if (ps) ps.disabled = true;
                        // Always save to server regardless of device-specific settings
                        await this.saveSettingsToServer(settings);
                    } catch (error) {
                        console.error('Error uploading font:', error);
                    }
                }
            });
            // Initial visibility
            this.toggleCustomFontInput(settings.enableCustomFont);
        }

        // Show page in title checkbox
        const showPageInTitleCheckbox = document.getElementById('show-page-in-title-checkbox');
        if (showPageInTitleCheckbox) {
            showPageInTitleCheckbox.checked = settings.showPageInTitle;
            showPageInTitleCheckbox.addEventListener('change', (e) => {
                settings.showPageInTitle = e.target.checked;
            });
        }

        // Show date checkbox
        const showDateCheckbox = document.getElementById('show-date-checkbox');
        if (showDateCheckbox) {
            showDateCheckbox.checked = settings.showDate;
            showDateCheckbox.addEventListener('change', (e) => {
                settings.showDate = e.target.checked;
            });
        }

        const showTimeCheckbox = document.getElementById('show-time-checkbox');
        if (showTimeCheckbox) {
            showTimeCheckbox.checked = settings.showTime !== false;
            showTimeCheckbox.addEventListener('change', (e) => {
                settings.showTime = e.target.checked;
            });
        }

        const timeFormatSelect = document.getElementById('time-format-select');
        if (timeFormatSelect) {
            const timeFormat = settings.timeFormat === '12h' ? '12h' : '24h';
            settings.timeFormat = timeFormat;
            timeFormatSelect.value = timeFormat;
            timeFormatSelect.addEventListener('change', (e) => {
                settings.timeFormat = e.target.value === '12h' ? '12h' : '24h';
            });
        }

        const dateFormatSelect = document.getElementById('date-format-select');
        if (dateFormatSelect) {
            dateFormatSelect.value = settings.dateFormat || 'short-slash';
            dateFormatSelect.addEventListener('change', (e) => {
                settings.dateFormat = e.target.value;
            });
        }

        const showWeatherWithDateCheckbox = document.getElementById('show-weather-with-date-checkbox');
        if (showWeatherWithDateCheckbox) {
            showWeatherWithDateCheckbox.checked = settings.showWeatherWithDate === true;
            showWeatherWithDateCheckbox.addEventListener('change', (e) => {
                settings.showWeatherWithDate = e.target.checked;
                this.toggleWeatherControls(e.target.checked, settings.weatherSource);
            });
        }

        const weatherSourceSelect = document.getElementById('weather-source-select');
        if (weatherSourceSelect) {
            weatherSourceSelect.value = settings.weatherSource || 'manual';
            weatherSourceSelect.addEventListener('change', (e) => {
                settings.weatherSource = e.target.value;
                this.toggleWeatherManualLocationInput(e.target.value);
            });
        }

        const weatherLocationInput = document.getElementById('weather-location-input');
        if (weatherLocationInput) {
            weatherLocationInput.value = settings.weatherLocation || '';
            weatherLocationInput.addEventListener('input', (e) => {
                settings.weatherLocation = e.target.value.trim();
            });
        }

        const weatherUnitSelect = document.getElementById('weather-unit-select');
        if (weatherUnitSelect) {
            weatherUnitSelect.value = settings.weatherUnit || 'celsius';
            weatherUnitSelect.addEventListener('change', (e) => {
                settings.weatherUnit = e.target.value;
            });
        }

        const weatherRefreshSelect = document.getElementById('weather-refresh-select');
        if (weatherRefreshSelect) {
            const currentRefresh = Number(settings.weatherRefreshMinutes || 30);
            weatherRefreshSelect.value = Number.isFinite(currentRefresh) && currentRefresh > 0 ? String(currentRefresh) : '30';
            weatherRefreshSelect.addEventListener('change', (e) => {
                const value = Number(e.target.value);
                settings.weatherRefreshMinutes = Number.isFinite(value) && value > 0 ? value : 30;
            });
        }
        this.toggleWeatherControls(settings.showWeatherWithDate === true, settings.weatherSource);

        // Show config button checkbox
        const showConfigButtonCheckbox = document.getElementById('show-config-button-checkbox');
        if (showConfigButtonCheckbox) {
            showConfigButtonCheckbox.checked = settings.showConfigButton;
            showConfigButtonCheckbox.addEventListener('change', (e) => {
                settings.showConfigButton = e.target.checked;
            });
        }

        // Show page names in tabs checkbox
        const showPageNamesInTabsCheckbox = document.getElementById('show-page-names-in-tabs-checkbox');
        if (showPageNamesInTabsCheckbox) {
            showPageNamesInTabsCheckbox.checked = settings.showPageNamesInTabs;
            showPageNamesInTabsCheckbox.addEventListener('change', (e) => {
                settings.showPageNamesInTabs = e.target.checked;
            });
        }

        // Show page tabs checkbox
        const showPageTabsCheckbox = document.getElementById('show-page-tabs-checkbox');
        if (showPageTabsCheckbox) {
            showPageTabsCheckbox.checked = settings.showPageTabs;
            showPageTabsCheckbox.addEventListener('change', (e) => {
                settings.showPageTabs = e.target.checked;
            });
        }

        // Always collapse categories checkbox
        const alwaysCollapseCategoriesCheckbox = document.getElementById('always-collapse-categories-checkbox');
        if (alwaysCollapseCategoriesCheckbox) {
            alwaysCollapseCategoriesCheckbox.checked = settings.alwaysCollapseCategories;
            alwaysCollapseCategoriesCheckbox.addEventListener('change', (e) => {
                settings.alwaysCollapseCategories = e.target.checked;
            });
        }

        // Show search button checkbox
        const showSearchButtonCheckbox = document.getElementById('show-search-button-checkbox');
        if (showSearchButtonCheckbox) {
            showSearchButtonCheckbox.checked = settings.showSearchButton;
            showSearchButtonCheckbox.addEventListener('change', (e) => {
                settings.showSearchButton = e.target.checked;
            });
        }

        // Show finders button checkbox
        const showFindersButtonCheckbox = document.getElementById('show-finders-button-checkbox');
        if (showFindersButtonCheckbox) {
            showFindersButtonCheckbox.checked = settings.showFindersButton;
            showFindersButtonCheckbox.addEventListener('change', (e) => {
                settings.showFindersButton = e.target.checked;
            });
        }

        // Show commands button checkbox
        const showCommandsButtonCheckbox = document.getElementById('show-commands-button-checkbox');
        if (showCommandsButtonCheckbox) {
            showCommandsButtonCheckbox.checked = settings.showCommandsButton;
            showCommandsButtonCheckbox.addEventListener('change', (e) => {
                settings.showCommandsButton = e.target.checked;
            });
        }

        // Show cheatsheet button checkbox
        const showCheatSheetButtonCheckbox = document.getElementById('show-cheatsheet-button-checkbox');
        if (showCheatSheetButtonCheckbox) {
            showCheatSheetButtonCheckbox.checked = settings.showCheatSheetButton !== false;
            showCheatSheetButtonCheckbox.addEventListener('change', (e) => {
                settings.showCheatSheetButton = e.target.checked;
            });
        }

        const showRecentButtonCheckbox = document.getElementById('show-recent-button-checkbox');
        if (showRecentButtonCheckbox) {
            showRecentButtonCheckbox.checked = settings.showRecentButton !== false;
            showRecentButtonCheckbox.addEventListener('change', (e) => {
                settings.showRecentButton = e.target.checked;
            });
        }

        const showTipsCheckbox = document.getElementById('show-tips-checkbox');
        if (showTipsCheckbox) {
            showTipsCheckbox.checked = settings.showTips !== false;
            showTipsCheckbox.addEventListener('change', (e) => {
                settings.showTips = e.target.checked;
            });
        }

        // Show search button text checkbox
        const showSearchButtonTextCheckbox = document.getElementById('show-search-button-text-checkbox');
        if (showSearchButtonTextCheckbox) {
            showSearchButtonTextCheckbox.checked = settings.showSearchButtonText !== false;
            showSearchButtonTextCheckbox.addEventListener('change', (e) => {
                settings.showSearchButtonText = e.target.checked;
            });
        }

        // Show finders button text checkbox
        const showFindersButtonTextCheckbox = document.getElementById('show-finders-button-text-checkbox');
        if (showFindersButtonTextCheckbox) {
            showFindersButtonTextCheckbox.checked = settings.showFindersButtonText !== false;
            showFindersButtonTextCheckbox.addEventListener('change', (e) => {
                settings.showFindersButtonText = e.target.checked;
            });
        }

        // Show commands button text checkbox
        const showCommandsButtonTextCheckbox = document.getElementById('show-commands-button-text-checkbox');
        if (showCommandsButtonTextCheckbox) {
            showCommandsButtonTextCheckbox.checked = settings.showCommandsButtonText !== false;
            showCommandsButtonTextCheckbox.addEventListener('change', (e) => {
                settings.showCommandsButtonText = e.target.checked;
            });
        }

        // Include finders in search checkbox
        const includeFindersInSearchCheckbox = document.getElementById('include-finders-in-search-checkbox');
        if (includeFindersInSearchCheckbox) {
            includeFindersInSearchCheckbox.checked = settings.includeFindersInSearch;
            includeFindersInSearchCheckbox.addEventListener('change', (e) => {
                settings.includeFindersInSearch = e.target.checked;
            });
        }

        // Animations enabled checkbox
        const animationsEnabledCheckbox = document.getElementById('animations-enabled-checkbox');
        if (animationsEnabledCheckbox) {
            animationsEnabledCheckbox.checked = settings.animationsEnabled !== false;
            animationsEnabledCheckbox.addEventListener('change', (e) => {
                settings.animationsEnabled = e.target.checked;
                if (callbacks.onAnimationsChange) callbacks.onAnimationsChange(e.target.checked);
            });
        }

        const showSyncToastsCheckbox = document.getElementById('show-sync-toasts-checkbox');
        if (showSyncToastsCheckbox) {
            showSyncToastsCheckbox.checked = settings.showSyncToasts !== false;
            showSyncToastsCheckbox.addEventListener('change', (e) => {
                settings.showSyncToasts = e.target.checked;
            });
        }

        // Show status checkbox
        const showStatusCheckbox = document.getElementById('show-status-checkbox');
        if (showStatusCheckbox) {
            showStatusCheckbox.checked = settings.showStatus;
            showStatusCheckbox.addEventListener('change', (e) => {
                settings.showStatus = e.target.checked;
                if (callbacks.onStatusVisibilityChange) callbacks.onStatusVisibilityChange();
            });
        }

        // Show ping checkbox
        const showPingCheckbox = document.getElementById('show-ping-checkbox');
        if (showPingCheckbox) {
            showPingCheckbox.checked = settings.showPing;
            showPingCheckbox.addEventListener('change', (e) => {
                settings.showPing = e.target.checked;
            });
        }

        // Show status loading checkbox
        const showStatusLoadingCheckbox = document.getElementById('show-status-loading-checkbox');
        if (showStatusLoadingCheckbox) {
            showStatusLoadingCheckbox.checked = settings.showStatusLoading;
            showStatusLoadingCheckbox.addEventListener('change', (e) => {
                settings.showStatusLoading = e.target.checked;
            });
        }

        // Skip fast ping checkbox
        const skipFastPingCheckbox = document.getElementById('skip-fast-ping-checkbox');
        if (skipFastPingCheckbox) {
            skipFastPingCheckbox.checked = settings.skipFastPing;
            skipFastPingCheckbox.addEventListener('change', (e) => {
                settings.skipFastPing = e.target.checked;
            });
        }

        // Global shortcuts checkbox
        const globalShortcutsCheckbox = document.getElementById('global-shortcuts-checkbox');
        if (globalShortcutsCheckbox) {
            globalShortcutsCheckbox.checked = settings.globalShortcuts || false;
            globalShortcutsCheckbox.addEventListener('change', (e) => {
                settings.globalShortcuts = e.target.checked;
            });
        }

        // Enable fuzzy suggestions checkbox
        const enableFuzzySuggestionsCheckbox = document.getElementById('enable-fuzzy-suggestions-checkbox');
        if (enableFuzzySuggestionsCheckbox) {
            enableFuzzySuggestionsCheckbox.checked = settings.enableFuzzySuggestions || false;
            enableFuzzySuggestionsCheckbox.addEventListener('change', (e) => {
                settings.enableFuzzySuggestions = e.target.checked;
                this.toggleFuzzySuggestionsStartWith(e.target.checked);
            });
        }

        // Initial visibility for fuzzy suggestions start with
        this.toggleFuzzySuggestionsStartWith(settings.enableFuzzySuggestions || false);

        // Fuzzy suggestions start with checkbox
        const fuzzySuggestionsStartWithCheckbox = document.getElementById('fuzzy-suggestions-start-with-checkbox');
        if (fuzzySuggestionsStartWithCheckbox) {
            fuzzySuggestionsStartWithCheckbox.checked = settings.fuzzySuggestionsStartWith || false;
            fuzzySuggestionsStartWithCheckbox.addEventListener('change', (e) => {
                settings.fuzzySuggestionsStartWith = e.target.checked;
            });
        }

        // Keep search open when empty checkbox
        const keepSearchOpenWhenEmptyCheckbox = document.getElementById('keep-search-open-when-empty-checkbox');
        if (keepSearchOpenWhenEmptyCheckbox) {
            keepSearchOpenWhenEmptyCheckbox.checked = settings.keepSearchOpenWhenEmpty || false;
            keepSearchOpenWhenEmptyCheckbox.addEventListener('change', (e) => {
                settings.keepSearchOpenWhenEmpty = e.target.checked;
            });
        }

        const showSmartRecentCollectionCheckbox = document.getElementById('show-smart-recent-collection-checkbox');
        if (showSmartRecentCollectionCheckbox) {
            showSmartRecentCollectionCheckbox.checked = settings.showSmartRecentCollection !== false;
            showSmartRecentCollectionCheckbox.addEventListener('change', (e) => {
                settings.showSmartRecentCollection = e.target.checked;
                this.toggleSmartCollectionControls('recent', e.target.checked);
            });
            this.toggleSmartCollectionControls('recent', showSmartRecentCollectionCheckbox.checked);
        }

        const showSmartStaleCollectionCheckbox = document.getElementById('show-smart-stale-collection-checkbox');
        if (showSmartStaleCollectionCheckbox) {
            showSmartStaleCollectionCheckbox.checked = settings.showSmartStaleCollection !== false;
            showSmartStaleCollectionCheckbox.addEventListener('change', (e) => {
                settings.showSmartStaleCollection = e.target.checked;
                this.toggleSmartCollectionControls('stale', e.target.checked);
            });
            this.toggleSmartCollectionControls('stale', showSmartStaleCollectionCheckbox.checked);
        }

        const showSmartMostUsedCollectionCheckbox = document.getElementById('show-smart-most-used-collection-checkbox');
        if (showSmartMostUsedCollectionCheckbox) {
            showSmartMostUsedCollectionCheckbox.checked = settings.showSmartMostUsedCollection === true;
            showSmartMostUsedCollectionCheckbox.addEventListener('change', (e) => {
                settings.showSmartMostUsedCollection = e.target.checked;
                this.toggleSmartCollectionControls('mostUsed', e.target.checked);
            });
            this.toggleSmartCollectionControls('mostUsed', showSmartMostUsedCollectionCheckbox.checked);
        }

        const smartRecentPagesSelect = document.getElementById('smart-recent-pages-select');
        if (smartRecentPagesSelect) {
            smartRecentPagesSelect.addEventListener('change', () => {
                settings.smartRecentPageIds = this.getSelectedPageIds(smartRecentPagesSelect);
            });
        }

        const smartRecentLimitSelect = document.getElementById('smart-recent-limit-select');
        if (smartRecentLimitSelect) {
            const currentLimit = Number(settings.smartRecentLimit ?? 50);
            const normalizedLimit = Number.isFinite(currentLimit) && currentLimit >= 0 ? currentLimit : 50;
            smartRecentLimitSelect.value = normalizedLimit === 0 ? '0' : String(normalizedLimit);
            smartRecentLimitSelect.addEventListener('change', (e) => {
                const value = Number(e.target.value);
                settings.smartRecentLimit = Number.isFinite(value) && value >= 0 ? value : 50;
            });
        }

        const smartStalePagesSelect = document.getElementById('smart-stale-pages-select');
        if (smartStalePagesSelect) {
            smartStalePagesSelect.addEventListener('change', () => {
                settings.smartStalePageIds = this.getSelectedPageIds(smartStalePagesSelect);
            });
        }

        const smartStaleLimitSelect = document.getElementById('smart-stale-limit-select');
        if (smartStaleLimitSelect) {
            const currentLimit = Number(settings.smartStaleLimit ?? 50);
            const normalizedLimit = Number.isFinite(currentLimit) && currentLimit >= 0 ? currentLimit : 50;
            smartStaleLimitSelect.value = normalizedLimit === 0 ? '0' : String(normalizedLimit);
            smartStaleLimitSelect.addEventListener('change', (e) => {
                const value = Number(e.target.value);
                settings.smartStaleLimit = Number.isFinite(value) && value >= 0 ? value : 50;
            });
        }

        const smartMostUsedPagesSelect = document.getElementById('smart-most-used-pages-select');
        if (smartMostUsedPagesSelect) {
            smartMostUsedPagesSelect.addEventListener('change', () => {
                settings.smartMostUsedPageIds = this.getSelectedPageIds(smartMostUsedPagesSelect);
            });
        }

        const smartMostUsedLimitSelect = document.getElementById('smart-most-used-limit-select');
        if (smartMostUsedLimitSelect) {
            const currentLimit = Number(settings.smartMostUsedLimit ?? 25);
            const normalizedLimit = Number.isFinite(currentLimit) && currentLimit >= 0 ? currentLimit : 25;
            smartMostUsedLimitSelect.value = normalizedLimit === 0 ? '0' : String(normalizedLimit);
            smartMostUsedLimitSelect.addEventListener('change', (e) => {
                const value = Number(e.target.value);
                settings.smartMostUsedLimit = Number.isFinite(value) && value >= 0 ? value : 25;
            });
        }
    }

    /**
     * Update settings from UI elements
     * @param {Object} settings - Reference to settings object
     */
    updateFromUI(settings) {
        const themeSelect = document.getElementById('theme-select');
        const columnsInput = document.getElementById('columns-input'); 
        const newTabCheckbox = document.getElementById('new-tab-checkbox');
        const hyprModeCheckbox = document.getElementById('hypr-mode-checkbox');
        const showTitleCheckbox = document.getElementById('show-title-checkbox');
        const showDateCheckbox = document.getElementById('show-date-checkbox');
        const showTimeCheckbox = document.getElementById('show-time-checkbox');
        const timeFormatSelect = document.getElementById('time-format-select');
        const showConfigButtonCheckbox = document.getElementById('show-config-button-checkbox');
        const showSearchButtonCheckbox = document.getElementById('show-search-button-checkbox');
        const showFindersButtonCheckbox = document.getElementById('show-finders-button-checkbox');
        const showCommandsButtonCheckbox = document.getElementById('show-commands-button-checkbox');
        const showCheatSheetButtonCheckbox = document.getElementById('show-cheatsheet-button-checkbox');
        const showRecentButtonCheckbox = document.getElementById('show-recent-button-checkbox');
        const showTipsCheckbox = document.getElementById('show-tips-checkbox');
        const showSearchButtonTextCheckbox = document.getElementById('show-search-button-text-checkbox');
        const showFindersButtonTextCheckbox = document.getElementById('show-finders-button-text-checkbox');
        const showCommandsButtonTextCheckbox = document.getElementById('show-commands-button-text-checkbox');
        const includeFindersInSearchCheckbox = document.getElementById('include-finders-in-search-checkbox');
        const showStatusCheckbox = document.getElementById('show-status-checkbox');
        const showPingCheckbox = document.getElementById('show-ping-checkbox');
        const showStatusLoadingCheckbox = document.getElementById('show-status-loading-checkbox');
        const skipFastPingCheckbox = document.getElementById('skip-fast-ping-checkbox');
        const globalShortcutsCheckbox = document.getElementById('global-shortcuts-checkbox');
        const animationsEnabledCheckbox = document.getElementById('animations-enabled-checkbox');
        const showSyncToastsCheckbox = document.getElementById('show-sync-toasts-checkbox');
        const enableCustomTitleCheckbox = document.getElementById('enable-custom-title-checkbox');
        const customTitleInput = document.getElementById('custom-title-input');
        const showPageInTitleCheckbox = document.getElementById('show-page-in-title-checkbox');
        const showPageNamesInTabsCheckbox = document.getElementById('show-page-names-in-tabs-checkbox');
        const enableCustomFaviconCheckbox = document.getElementById('enable-custom-favicon-checkbox');
        const languageSelect = document.getElementById('language-select');
        const interleaveModeCheckbox = document.getElementById('interleave-mode-checkbox');
        const enableFuzzySuggestionsCheckbox = document.getElementById('enable-fuzzy-suggestions-checkbox');
        const fuzzySuggestionsStartWithCheckbox = document.getElementById('fuzzy-suggestions-start-with-checkbox');
        const keepSearchOpenWhenEmptyCheckbox = document.getElementById('keep-search-open-when-empty-checkbox');
        const showSmartRecentCollectionCheckbox = document.getElementById('show-smart-recent-collection-checkbox');
        const showSmartStaleCollectionCheckbox = document.getElementById('show-smart-stale-collection-checkbox');
        const showSmartMostUsedCollectionCheckbox = document.getElementById('show-smart-most-used-collection-checkbox');
        const smartRecentPagesSelect = document.getElementById('smart-recent-pages-select');
        const smartStalePagesSelect = document.getElementById('smart-stale-pages-select');
        const smartMostUsedPagesSelect = document.getElementById('smart-most-used-pages-select');
        const smartRecentLimitSelect = document.getElementById('smart-recent-limit-select');
        const smartStaleLimitSelect = document.getElementById('smart-stale-limit-select');
        const smartMostUsedLimitSelect = document.getElementById('smart-most-used-limit-select');
        const dateFormatSelect = document.getElementById('date-format-select');
        const showWeatherWithDateCheckbox = document.getElementById('show-weather-with-date-checkbox');
        const weatherSourceSelect = document.getElementById('weather-source-select');
        const weatherLocationInput = document.getElementById('weather-location-input');
        const weatherUnitSelect = document.getElementById('weather-unit-select');
        const weatherRefreshSelect = document.getElementById('weather-refresh-select');
        const densityModeSelect = document.getElementById('density-mode-select');

        if (themeSelect) settings.theme = themeSelect.value;
        if (columnsInput) settings.columnsPerRow = parseInt(columnsInput.value);
        if (newTabCheckbox) settings.openInNewTab = newTabCheckbox.checked;
        if (hyprModeCheckbox) settings.hyprMode = hyprModeCheckbox.checked;
        if (showTitleCheckbox) settings.showTitle = showTitleCheckbox.checked;
        if (showDateCheckbox) settings.showDate = showDateCheckbox.checked;
        if (showTimeCheckbox) settings.showTime = showTimeCheckbox.checked;
        if (timeFormatSelect) settings.timeFormat = timeFormatSelect.value === '12h' ? '12h' : '24h';
        if (showConfigButtonCheckbox) settings.showConfigButton = showConfigButtonCheckbox.checked;
        if (showSearchButtonCheckbox) settings.showSearchButton = showSearchButtonCheckbox.checked;
        if (showFindersButtonCheckbox) settings.showFindersButton = showFindersButtonCheckbox.checked;
        if (showCommandsButtonCheckbox) settings.showCommandsButton = showCommandsButtonCheckbox.checked;
        if (showCheatSheetButtonCheckbox) settings.showCheatSheetButton = showCheatSheetButtonCheckbox.checked;
        if (showRecentButtonCheckbox) settings.showRecentButton = showRecentButtonCheckbox.checked;
        if (showTipsCheckbox) settings.showTips = showTipsCheckbox.checked;
        if (showSearchButtonTextCheckbox) settings.showSearchButtonText = showSearchButtonTextCheckbox.checked;
        if (showFindersButtonTextCheckbox) settings.showFindersButtonText = showFindersButtonTextCheckbox.checked;
        if (showCommandsButtonTextCheckbox) settings.showCommandsButtonText = showCommandsButtonTextCheckbox.checked;
        if (includeFindersInSearchCheckbox) settings.includeFindersInSearch = includeFindersInSearchCheckbox.checked;
        if (animationsEnabledCheckbox) settings.animationsEnabled = animationsEnabledCheckbox.checked;
        if (showSyncToastsCheckbox) settings.showSyncToasts = showSyncToastsCheckbox.checked;
        if (showStatusCheckbox) settings.showStatus = showStatusCheckbox.checked;
        if (showPingCheckbox) settings.showPing = showPingCheckbox.checked;
        if (showStatusLoadingCheckbox) settings.showStatusLoading = showStatusLoadingCheckbox.checked;
        if (skipFastPingCheckbox) settings.skipFastPing = skipFastPingCheckbox.checked;
        if (globalShortcutsCheckbox) settings.globalShortcuts = globalShortcutsCheckbox.checked;
        if (enableCustomTitleCheckbox) settings.enableCustomTitle = enableCustomTitleCheckbox.checked;
        if (customTitleInput) settings.customTitle = customTitleInput.value;
        if (showPageInTitleCheckbox) settings.showPageInTitle = showPageInTitleCheckbox.checked;
        if (showPageNamesInTabsCheckbox) settings.showPageNamesInTabs = showPageNamesInTabsCheckbox.checked;
        const showPageTabsCheckbox = document.getElementById('show-page-tabs-checkbox');
        if (showPageTabsCheckbox) settings.showPageTabs = showPageTabsCheckbox.checked;
        const alwaysCollapseCategoriesCheckbox = document.getElementById('always-collapse-categories-checkbox');
        if (alwaysCollapseCategoriesCheckbox) settings.alwaysCollapseCategories = alwaysCollapseCategoriesCheckbox.checked;
        if (enableCustomFaviconCheckbox) settings.enableCustomFavicon = enableCustomFaviconCheckbox.checked;
        if (languageSelect) settings.language = languageSelect.value;
        if (interleaveModeCheckbox) settings.interleaveMode = interleaveModeCheckbox.checked;
        if (enableFuzzySuggestionsCheckbox) settings.enableFuzzySuggestions = enableFuzzySuggestionsCheckbox.checked;
        if (fuzzySuggestionsStartWithCheckbox) settings.fuzzySuggestionsStartWith = fuzzySuggestionsStartWithCheckbox.checked;
        if (keepSearchOpenWhenEmptyCheckbox) settings.keepSearchOpenWhenEmpty = keepSearchOpenWhenEmptyCheckbox.checked;
        if (showSmartRecentCollectionCheckbox) settings.showSmartRecentCollection = showSmartRecentCollectionCheckbox.checked;
        if (showSmartStaleCollectionCheckbox) settings.showSmartStaleCollection = showSmartStaleCollectionCheckbox.checked;
        if (showSmartMostUsedCollectionCheckbox) settings.showSmartMostUsedCollection = showSmartMostUsedCollectionCheckbox.checked;
        if (smartRecentPagesSelect) settings.smartRecentPageIds = this.getSelectedPageIds(smartRecentPagesSelect);
        if (smartStalePagesSelect) settings.smartStalePageIds = this.getSelectedPageIds(smartStalePagesSelect);
        if (smartMostUsedPagesSelect) settings.smartMostUsedPageIds = this.getSelectedPageIds(smartMostUsedPagesSelect);
        if (smartRecentLimitSelect) {
            const parsedLimit = Number(smartRecentLimitSelect.value);
            settings.smartRecentLimit = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 50;
        }
        if (smartStaleLimitSelect) {
            const parsedLimit = Number(smartStaleLimitSelect.value);
            settings.smartStaleLimit = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 50;
        }
        if (smartMostUsedLimitSelect) {
            const parsedLimit = Number(smartMostUsedLimitSelect.value);
            settings.smartMostUsedLimit = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 25;
        }
        if (dateFormatSelect) settings.dateFormat = dateFormatSelect.value;
        if (showWeatherWithDateCheckbox) settings.showWeatherWithDate = showWeatherWithDateCheckbox.checked;
        if (weatherSourceSelect) settings.weatherSource = weatherSourceSelect.value;
        if (weatherLocationInput) settings.weatherLocation = weatherLocationInput.value.trim();
        if (weatherUnitSelect) settings.weatherUnit = weatherUnitSelect.value;
        if (weatherRefreshSelect) {
            const parsedRefresh = Number(weatherRefreshSelect.value);
            settings.weatherRefreshMinutes = Number.isFinite(parsedRefresh) && parsedRefresh > 0 ? parsedRefresh : 30;
        }
        if (densityModeSelect) {
            settings.densityMode = ['comfortable', 'compact', 'dense', 'auto'].includes(densityModeSelect.value)
                ? densityModeSelect.value
                : 'compact';
        }
        const packedColumnsCheckbox = document.getElementById('packed-columns-checkbox');
        if (packedColumnsCheckbox) settings.packedColumns = packedColumnsCheckbox.checked;
        const showIconsCheckbox = document.getElementById('show-icons-checkbox');
        if (showIconsCheckbox) settings.showIcons = showIconsCheckbox.checked;
        const showShortcutsCheckbox = document.getElementById('show-shortcuts-checkbox');
        if (showShortcutsCheckbox) settings.showShortcuts = showShortcutsCheckbox.checked;
        const showPinIconCheckbox = document.getElementById('show-pin-icon-checkbox');
        if (showPinIconCheckbox) settings.showPinIcon = showPinIconCheckbox.checked;
    }

    /**
     * Apply theme to page
     * @param {string} theme
     */
    applyTheme(theme) {
        const normalizedTheme = this.normalizeThemeId(theme);

        // Remove all theme classes
        document.body.classList.remove('dark', 'light');

        // Remove any custom theme classes
        const themeIds = Array.isArray(this.customThemes)
            ? this.customThemes
            : Object.keys(this.customThemes || {});
        themeIds.forEach(themeId => document.body.classList.remove(themeId));
        
        // Add the new theme class
        document.body.classList.add(normalizedTheme);
        document.body.setAttribute('data-theme', normalizedTheme);
        
        if (window.ThemeLoader) {
            const showBackgroundDots = document.getElementById('show-background-dots-checkbox')?.checked !== false;
            // Get current font size from body classes
            const currentClasses = Array.from(document.body.classList);
            const currentFontSizeClass = currentClasses.find(cls => cls.startsWith('font-size-'));
            const currentFontSize = currentFontSizeClass ? currentFontSizeClass.replace('font-size-', '') : 'm';
            window.ThemeLoader.applyTheme(normalizedTheme, showBackgroundDots, currentFontSize);
        }
    }

    reloadThemeCSS() {
        const link = document.querySelector('link[href^="/api/theme.css"]');
        if (!link || !link.parentNode) {
            return;
        }

        const newLink = link.cloneNode(true);
        newLink.href = `/api/theme.css?t=${Date.now()}`;
        link.parentNode.replaceChild(newLink, link);
    }

    /**
     * Apply font size to page
     * @param {string} fontSize
     */
    applyFontSize(fontSize) {
        document.body.classList.remove('font-size-xs', 'font-size-s', 'font-size-sm', 'font-size-m', 'font-size-lg', 'font-size-l', 'font-size-xl');
        document.body.classList.add(`font-size-${fontSize}`);
    }

    /**
     * Apply background dots setting
     * @param {boolean} showBackgroundDots
     */
    applyBackgroundDots(showBackgroundDots) {
        // Use ThemeLoader to apply background dots consistently
        if (window.ThemeLoader) {
            const theme = document.body.getAttribute('data-theme') || 'dark';
            // Get current font size from body classes
            const currentClasses = Array.from(document.body.classList);
            const currentFontSizeClass = currentClasses.find(cls => cls.startsWith('font-size-'));
            const currentFontSize = currentFontSizeClass ? currentFontSizeClass.replace('font-size-', '') : 'm';
            window.ThemeLoader.applyTheme(theme, showBackgroundDots, currentFontSize);
        }
        
        // Also set the data attribute for consistency
        if (showBackgroundDots !== false) {
            document.body.setAttribute('data-show-background-dots', 'true');
        } else {
            document.body.setAttribute('data-show-background-dots', 'false');
        }
    }

    /**
     * Update status options visibility
     * @param {boolean} showStatus
     */
    updateStatusOptionsVisibility(showStatus) {
        const statusNested = document.querySelector('.status-settings-nested');
        
        if (statusNested) {
            if (showStatus) {
                statusNested.style.display = 'block';
            } else {
                statusNested.style.display = 'none';
                // Also uncheck ping when status is disabled
                const showPingCheckbox = document.getElementById('show-ping-checkbox');
                if (showPingCheckbox) {
                    showPingCheckbox.checked = false;
                }
            }
        }
    }

    /**
     * Toggle custom title input visibility
     * @param {boolean} enabled
     */
    toggleCustomTitleInput(enabled) {
        // Find the checkbox
        const checkbox = document.getElementById('enable-custom-title-checkbox');
        if (!checkbox) return;
        
        // Find the parent item
        const parentItem = checkbox.closest('.checkbox-tree-item');
        if (!parentItem) return;
        
        // Find all sibling items after this one that are checkbox-tree-child
        const siblings = Array.from(parentItem.parentNode.children);
        const startIndex = siblings.indexOf(parentItem);
        
        for (let i = startIndex + 1; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling.classList.contains('checkbox-tree-child')) {
                sibling.style.display = enabled ? 'block' : 'none';
            } else {
                // Stop at the first non-child item (assuming they are grouped)
                break;
            }
        }
    }

    /**
     * Toggle fuzzy suggestions start with visibility
     * @param {boolean} enabled
     */
    toggleFuzzySuggestionsStartWith(enabled) {
        // Find the checkbox
        const checkbox = document.getElementById('enable-fuzzy-suggestions-checkbox');
        if (!checkbox) return;
        
        // Find the parent item
        const parentItem = checkbox.closest('.checkbox-tree-item');
        if (!parentItem) return;
        
        // Find all sibling items after this one that are checkbox-tree-child
        const siblings = Array.from(parentItem.parentNode.children);
        const startIndex = siblings.indexOf(parentItem);
        
        for (let i = startIndex + 1; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling.classList.contains('checkbox-tree-child')) {
                sibling.style.display = enabled ? 'block' : 'none';
            } else {
                // Stop at the first non-child item (assuming they are grouped)
                break;
            }
        }
    }

    /**
     * Toggle custom favicon input visibility
     * @param {boolean} enabled
     */
    toggleCustomFaviconInput(enabled) {
        // Find the checkbox
        const checkbox = document.getElementById('enable-custom-favicon-checkbox');
        if (!checkbox) return;
        
        // Find the parent item
        const parentItem = checkbox.closest('.checkbox-tree-item');
        if (!parentItem) return;
        
        // Find all sibling items after this one that are checkbox-tree-child
        const siblings = Array.from(parentItem.parentNode.children);
        const startIndex = siblings.indexOf(parentItem);
        
        for (let i = startIndex + 1; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling.classList.contains('checkbox-tree-child')) {
                sibling.style.display = enabled ? 'block' : 'none';
            } else {
                // Stop at the first non-child item (assuming they are grouped)
                break;
            }
        }
    }

    /**
     * Toggle visibility of custom font input based on checkbox state
     * @param {boolean} enabled - Whether custom font is enabled
     */
    toggleCustomFontInput(enabled) {
        // Find the checkbox
        const checkbox = document.getElementById('enable-custom-font-checkbox');
        if (!checkbox) return;
        
        // Find the parent item
        const parentItem = checkbox.closest('.checkbox-tree-item');
        if (!parentItem) return;
        
        // Find all sibling items after this one that are checkbox-tree-child
        const siblings = Array.from(parentItem.parentNode.children);
        const startIndex = siblings.indexOf(parentItem);
        
        for (let i = startIndex + 1; i < siblings.length; i++) {
            const sibling = siblings[i];
            if (sibling.classList.contains('checkbox-tree-child')) {
                sibling.style.display = enabled ? 'block' : 'none';
            } else {
                // Stop at the first non-child item (assuming they are grouped)
                break;
            }
        }
    }

    toggleWeatherManualLocationInput(source) {
        const weatherLocationInput = document.getElementById('weather-location-input');
        if (!weatherLocationInput) return;
        const shouldDisable = source === 'browser';
        weatherLocationInput.disabled = shouldDisable;
        const row = weatherLocationInput.closest('.checkbox-tree-child');
        if (row) {
            row.classList.toggle('is-disabled', shouldDisable);
        }
    }

    toggleWeatherControls(enabled, source) {
        const ids = ['weather-source-select', 'weather-location-input', 'weather-unit-select', 'weather-refresh-select'];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = !enabled;
            const row = el.closest('.checkbox-tree-child');
            if (row) {
                row.classList.toggle('is-disabled', !enabled);
            }
        });
        if (enabled) {
            this.toggleWeatherManualLocationInput(source || 'manual');
        }
    }

    /**
     * Reset settings to defaults
     * @returns {Object} - Default settings
     */
    getDefaults() {
        return {
            theme: 'cherry-graphite-dark',
            openInNewTab: true,
            columnsPerRow: 3,
            fontSize: 'm',
            showBackgroundDots: true,
            showTitle: true,
            showDate: true,
            showTime: true,
            timeFormat: '24h',
            dateFormat: 'short-slash',
            showWeatherWithDate: false,
            weatherSource: 'manual',
            weatherLocation: '',
            weatherUnit: 'celsius',
            weatherRefreshMinutes: 30,
            showConfigButton: true,
            showSearchButton: true,
            showFindersButton: true,
            showCommandsButton: true,
            showCheatSheetButton: true,
            showRecentButton: true,
            showTips: true,
            showSearchButtonText: true,
            showFindersButtonText: true,
            showCommandsButtonText: true,
            showStatus: false,
            showPing: false,
            showPinIcon: false,
            showShortcuts: true,
            showIcons: false,
            globalShortcuts: true,
            hyprMode: false,
            animationsEnabled: true,
            showSyncToasts: true,
            enableCustomTitle: false,
            customTitle: '',
            showPageInTitle: false,
            showPageNamesInTabs: false,
            enableCustomFavicon: false,
            customFaviconPath: '',
            language: 'en',
            interleaveMode: false,
            showPageTabs: true,
            alwaysCollapseCategories: false,
            backgroundOpacity: 1,
            fontWeight: 'normal',
            fontPreset: 'source-code-pro',
            autoDarkMode: false,
            showSmartRecentCollection: false,
            showSmartStaleCollection: false,
            showSmartMostUsedCollection: false,
            smartRecentLimit: 50,
            smartStaleLimit: 50,
            smartMostUsedLimit: 25,
            smartRecentPageIds: [],
            smartStalePageIds: [],
            smartMostUsedPageIds: [],
            packedColumns: true,
            densityMode: 'compact'
        };
    }

    /**
     * Apply animations setting to page
     * @param {boolean} enabled
     */
    applyAnimations(enabled) {
        if (enabled) {
            document.body.classList.remove('no-animations');
        } else {
            document.body.classList.add('no-animations');
        }
    }

    applyBackgroundOpacity(value) {
        const opacity = Number(value ?? 1);
        const clamped = Number.isFinite(opacity) ? Math.min(1, Math.max(0.65, opacity)) : 1;
        document.documentElement.style.setProperty('--dashboard-bg-opacity', String(clamped));
        document.body.style.opacity = String(clamped);
    }

    applyFontWeight(value) {
        const fontWeight = value || 'normal';
        document.documentElement.style.setProperty('--dashboard-font-weight', fontWeight);
        document.body.style.fontWeight = fontWeight;
    }

    applyAutoDarkMode(enabled, settings) {
        if (!enabled || !window.matchMedia) {
            return;
        }

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => {
            const nextTheme = this.getPairedThemeVariant(settings?.theme || 'dark', media.matches);
            if (settings) {
                settings.theme = nextTheme;
            }
            this.applyTheme(nextTheme);
            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) {
                const hasTheme = Array.from(themeSelect.options).some((option) => option.value === nextTheme);
                if (hasTheme) {
                    themeSelect.value = nextTheme;
                }
            }
        };

        apply();

        if (!this._autoDarkModeListenerAttached && typeof media.addEventListener === 'function') {
            media.addEventListener('change', apply);
            this._autoDarkModeListenerAttached = true;
        }
    }

    /**
     * Save settings to server (used for favicon changes to always persist globally)
     * @param {Object} settings
     */
    /**
     * @returns {Promise<boolean>}
     */
    async saveSettingsToServer(settings) {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!response.ok) {
                console.error('Settings save failed:', response.status);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error saving settings to server:', error);
            return false;
        }
    }
}

// Export for use in other modules
window.ConfigSettings = ConfigSettings;
