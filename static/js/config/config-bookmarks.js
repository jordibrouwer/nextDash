/**
 * Bookmarks Module
 * Handles bookmark management (create, render, remove, reorder)
 */

class ConfigBookmarks {
    constructor(t) {
        this.t = t; // Translation function
        this.bookmarkReorder = null;
        this.currentFilterCategory = '__all__';
        this.keyboardReorderHandler = null;
        this.selectedBookmarkIndexes = new Set();
        this.pendingIconUndo = null;
    }

    isBookmarkUncategorized(bookmark) {
        const c = bookmark?.category;
        return c === undefined || c === null || String(c).trim() === '';
    }

    /**
     * Persist visible bookmark row inputs into bookmarksData before DOM is cleared (filter change, re-render).
     */
    flushBookmarkFormsToData(bookmarks) {
        if (!Array.isArray(bookmarks)) {
            return;
        }
        const list = document.getElementById('bookmarks-list');
        if (!list) {
            return;
        }
        list.querySelectorAll('.bookmark-item').forEach((item) => {
            const idx = parseInt(item.getAttribute('data-bookmark-index'), 10);
            if (Number.isNaN(idx) || idx < 0 || idx >= bookmarks.length) {
                return;
            }
            const ref = bookmarks[idx];
            if (!ref) {
                return;
            }
            const nameEl = document.getElementById(`bookmark-name-${idx}`);
            const urlEl = document.getElementById(`bookmark-url-${idx}`);
            const scEl = document.getElementById(`bookmark-shortcut-${idx}`);
            const catEl = document.getElementById(`bookmark-category-${idx}`);
            const csEl = document.getElementById(`bookmark-checkStatus-${idx}`);
            const pinEl = document.getElementById(`bookmark-pinned-${idx}`);
            if (nameEl) {
                ref.name = nameEl.value;
            }
            if (urlEl) {
                ref.url = urlEl.value;
            }
            if (scEl) {
                ref.shortcut = scEl.value;
            }
            if (catEl) {
                ref.category = catEl.value;
            }
            if (csEl) {
                ref.checkStatus = csEl.checked;
            }
            if (pinEl) {
                ref.pinned = pinEl.checked;
            }
        });
    }

    /**
     * Render bookmarks list
     * @param {Array} bookmarks
     * @param {Array} categories
     */
    render(bookmarks, categories, options = {}) {
        const container = document.getElementById('bookmarks-list');
        if (!container) return;

        if (!options.skipFlush) {
            this.flushBookmarkFormsToData(bookmarks);
        }

        this.currentFilterCategory = options.filterCategory || this.currentFilterCategory;

        container.innerHTML = '';

        const scopedBookmarks = this.getScopedBookmarks(bookmarks, this.currentFilterCategory);

        if (scopedBookmarks.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-state-icon">📚</div>
                <div class="empty-state-text">${this.t('config.noBookmarks') || 'No bookmarks in this category'}</div>
                <div class="empty-state-subtext">Use "Add Bookmark" below, or restore a ZIP backup on the Backups tab.</div>
                <div class="empty-state-action">
                    <a class="btn btn-secondary btn-small" href="/config#backups" data-i18n="config.importDescription">Import your data</a>
                </div>
            `;
            container.appendChild(emptyState);
            if (typeof configManager !== 'undefined' && configManager.language && typeof configManager.language.applyTranslations === 'function') {
                configManager.language.applyTranslations();
            }
            this.updateBulkSelectionToolbar();
            return;
        }

        scopedBookmarks.forEach(({ bookmark, index }) => {
            const bookmarkElement = this.createBookmarkElement(bookmark, index, bookmarks, categories, index);
            container.appendChild(bookmarkElement);
        });

        this.updateBulkSelectionToolbar();
    }

    moveStaleBookmarksToArchive() {
        if (!window.configManager || !Array.isArray(window.configManager.bookmarksData)) {
            return;
        }

        const now = Date.now();
        const staleThresholdMs = 30 * 24 * 60 * 60 * 1000;
        const archiveCategoryId = 'archive';

        if (!Array.isArray(window.configManager.categoriesData)) {
            window.configManager.categoriesData = [];
        }

        const hasArchive = window.configManager.categoriesData.some((category) => category.id === archiveCategoryId);
        if (!hasArchive) {
            window.configManager.categoriesData.push({
                id: archiveCategoryId,
                name: 'Archive',
                icon: '📦'
            });
            if (window.configManager.categories && typeof window.configManager.categories.render === 'function') {
                window.configManager.categories.render(
                    window.configManager.categoriesData,
                    window.configManager.generateId.bind(window.configManager)
                );
            }
        }

        let moved = 0;
        window.configManager.bookmarksData.forEach((bookmark) => {
            const lastOpened = Number(bookmark.lastOpened || 0);
            const isStale = lastOpened === 0 || (now - lastOpened) > staleThresholdMs;
            if (!isStale) {
                return;
            }
            if (bookmark.category !== archiveCategoryId) {
                bookmark.category = archiveCategoryId;
                moved += 1;
            }
        });

        window.configManager.refreshBookmarksFilterOptions();
        window.configManager.refreshBookmarksList();

        if (window.configManager.ui) {
            if (moved > 0) {
                window.configManager.ui.showNotification(`Moved ${moved} stale bookmark(s) to Archive.`, 'success');
            } else {
                window.configManager.ui.showNotification('No stale bookmarks to move in this page.', 'info');
            }
        }
    }

    mergeDuplicatesByUrl(url) {
        if (!url || !window.configManager || !Array.isArray(window.configManager.bookmarksData)) {
            return;
        }

        const normalized = url.trim().toLowerCase();
        const seen = new Set();
        window.configManager.bookmarksData = window.configManager.bookmarksData.filter((bookmark) => {
            const bookmarkUrl = (bookmark.url || '').trim().toLowerCase();
            if (bookmarkUrl !== normalized) {
                return true;
            }
            if (seen.has(bookmarkUrl)) {
                return false;
            }
            seen.add(bookmarkUrl);
            return true;
        });

        window.configManager.refreshBookmarksList();
        if (window.configManager.ui) {
            window.configManager.ui.showNotification('Duplicates merged for selected URL.', 'success');
        }
    }

    getScopedBookmarks(bookmarks, filterCategory = '__all__') {
        if (!Array.isArray(bookmarks)) {
            return [];
        }

        if (filterCategory === '__all__') {
            return bookmarks.map((bookmark, index) => ({ bookmark, index }));
        }

        if (filterCategory === '__none__') {
            return bookmarks
                .map((bookmark, index) => ({ bookmark, index }))
                .filter(({ bookmark }) => this.isBookmarkUncategorized(bookmark));
        }

        return bookmarks
            .map((bookmark, index) => ({ bookmark, index }))
            .filter(({ bookmark }) => bookmark.category === filterCategory);
    }

    /**
     * Create a bookmark DOM element
     * @param {Object} bookmark
     * @param {number} index
     * @param {Array} bookmarks - Reference to bookmarks array
     * @param {Array} categories
     * @returns {HTMLElement}
     */
    createBookmarkElement(bookmark, index, bookmarks, categories, fullIndex = index) {
        const div = document.createElement('div');
        div.className = 'bookmark-item js-item is-idle';
        div.setAttribute('data-bookmark-index', fullIndex);
        // Use index as a stable identifier since bookmarks don't have IDs
        div.setAttribute('data-bookmark-key', fullIndex);

        // Create category options
        const cats = Array.isArray(categories) ? categories : [];
        const categoryOptions = cats.map(cat => 
            `<option value="${cat.id}" ${cat.id === bookmark.category ? 'selected' : ''}>${cat.name}</option>`
        ).join('');
        const iconUrlValue = bookmark.icon ? `/data/icons/${bookmark.icon}` : '';

        div.innerHTML = `
            <label class="bookmark-select-wrap">
                <input type="checkbox" class="bookmark-select-checkbox" data-bookmark-select="${fullIndex}" ${this.selectedBookmarkIndexes.has(fullIndex) ? 'checked' : ''}>
            </label>
            <span class="drag-handle js-drag-handle" title="Drag to reorder">⠿</span>
            <button type="button" class="btn btn-secondary btn-small" onclick="configManager.moveBookmark(${fullIndex})" title="${this.t('config.moveBookmark')}" data-tooltip="Move bookmark">→</button>
            <input type="text" id="bookmark-name-${fullIndex}" name="bookmark-name-${fullIndex}" value="${bookmark.name}" placeholder="${this.t('config.bookmarkNamePlaceholder')}" data-bookmark-key="${fullIndex}" data-field="name">
            <input type="url" id="bookmark-url-${fullIndex}" name="bookmark-url-${fullIndex}" value="${bookmark.url}" placeholder="${this.t('config.bookmarkUrlPlaceholder')}" data-bookmark-key="${fullIndex}" data-field="url">
            <input type="text" id="bookmark-shortcut-${fullIndex}" name="bookmark-shortcut-${fullIndex}" value="${bookmark.shortcut || ''}" placeholder="${this.t('config.bookmarkShortcutPlaceholder')}" maxlength="5" data-bookmark-key="${fullIndex}" data-field="shortcut">
            <div class="bookmark-icon-upload">
                <input type="file" id="bookmark-icon-file-${fullIndex}" accept="image/*,.ico,.svg,.webp" hidden>
                <span class="bookmark-icon-preview ${bookmark.icon ? 'has-icon' : ''}" aria-hidden="true">
                    ${bookmark.icon ? `<img src="/data/icons/${bookmark.icon}" alt="">` : '<span class="bookmark-icon-preview-empty">No icon</span>'}
                </span>
                <button
                    type="button"
                    class="btn btn-secondary btn-small btn-upload-icon btn-icon-only ${bookmark.icon ? 'has-icon' : ''}"
                    aria-label="Upload icon"
                    data-tooltip="Upload icon"
                    title="Upload icon"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M12 3l4 4h-3v7h-2V7H8l4-4zm-7 13h14v5H5v-5zm2 2v1h10v-1H7z"></path>
                    </svg>
                </button>
                <input type="url" id="bookmark-icon-url-${fullIndex}" name="bookmark-icon-url-${fullIndex}" value="${iconUrlValue}" placeholder="https://.../icon.png">
                <button
                    type="button"
                    class="btn btn-secondary btn-small btn-set-icon-url btn-icon-only"
                    aria-label="Set icon URL"
                    data-tooltip="Set icon URL"
                    title="Set icon URL"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M10.59 13.41a1.996 1.996 0 010-2.82l3.18-3.18a2 2 0 112.83 2.83l-1.59 1.59 1.41 1.41 1.59-1.59a4 4 0 10-5.66-5.66l-3.18 3.18a4 4 0 000 5.66l.71.71 1.41-1.41-.7-.72zm2.82 4.24a4 4 0 005.66 0l3.18-3.18a4 4 0 00-5.66-5.66l-.71.71 1.41 1.41.71-.71a2 2 0 112.83 2.83l-3.18 3.18a2 2 0 11-2.83-2.83l1.59-1.59-1.41-1.41-1.59 1.59a4 4 0 000 5.66zM8 16H4v4h4v-4z"></path>
                    </svg>
                </button>
                <button
                    type="button"
                    class="btn btn-secondary btn-small btn-clear-icon btn-icon-only"
                    aria-label="Clear icon"
                    data-tooltip="Clear icon"
                    title="Clear icon"
                    ${bookmark.icon ? '' : 'disabled'}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <path d="M6 7h12v2H6V7zm2 3h8l-1 10H9L8 10zm3-6h2l1 2h5v2H5V6h5l1-2z"></path>
                    </svg>
                </button>
            </div>
            <select id="bookmark-category-${fullIndex}" name="bookmark-category-${fullIndex}" data-bookmark-key="${fullIndex}" data-field="category">
                <option value="">${this.t('config.noCategory')}</option>
                ${categoryOptions}
            </select>
            <div class="bookmark-status-toggle">
                <label class="checkbox-label icon-toggle" title="Toggle status check">
                    <input type="checkbox" id="bookmark-checkStatus-${fullIndex}" name="bookmark-checkStatus-${fullIndex}" ${bookmark.checkStatus ? 'checked' : ''} data-bookmark-key="${fullIndex}" data-field="checkStatus">
                    <span class="icon-toggle-indicator" data-tooltip="Status check" aria-hidden="true">
                        <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M3 12h4l2-5 4 10 2-5h6v2h-4l-2 5-4-10-2 5H3z"></path>
                        </svg>
                    </span>
                </label>
            </div>
            <label class="checkbox-label bookmark-pin-label icon-toggle" title="Toggle pin">
                <input type="checkbox" id="bookmark-pinned-${fullIndex}" data-bookmark-key="${fullIndex}" data-field="pinned" ${bookmark.pinned ? 'checked' : ''}>
                <span class="icon-toggle-indicator" data-tooltip="Pin" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M8 3h8l-1 5 3 3v1H6v-1l3-3-1-5zm4 10v8h-1v-8h1z"></path>
                    </svg>
                </span>
            </label>
            <button
                type="button"
                class="btn btn-danger btn-small btn-icon-only btn-delete-bookmark"
                onclick="configManager.removeBookmark(${fullIndex})"
                aria-label="${this.t('config.remove')}"
                title="${this.t('config.remove')}"
                data-tooltip="Remove bookmark"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M6 7h12v2H6V7zm2 3h8l-1 10H9L8 10zm3-6h2l1 2h5v2H5V6h5l1-2z"></path>
                </svg>
            </button>
        `;

        // Store reference to the actual bookmark object
        div._bookmarkRef = bookmark;
        
        // Add event listeners for field changes
        const inputs = div.querySelectorAll('input, select');
        inputs.forEach(input => {
            const eventType = input.type === 'text' || input.type === 'url' ? 'input' : 'change';
            input.addEventListener(eventType, (e) => {
                const field = e.target.getAttribute('data-field');
                
                // Update the bookmark object directly via stored reference
                if (field === 'checkStatus') {
                    bookmark[field] = e.target.checked;
                } else if (field === 'pinned') {
                    bookmark[field] = e.target.checked;
                } else {
                    bookmark[field] = e.target.value;
                }
                
                // Convert shortcut to uppercase and allow only letters (no numbers)
                if (field === 'shortcut') {
                    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                    bookmark[field] = e.target.value;
                }

                if (field === 'url') {
                    const duplicate = bookmarks.some((otherBookmark, otherIndex) => otherIndex !== fullIndex && (otherBookmark.url || '').trim().toLowerCase() === e.target.value.trim().toLowerCase());
                    e.target.classList.toggle('field-conflict', duplicate);
                    if (window.configManager && typeof window.configManager.validateBookmarkConflicts === 'function') {
                        window.configManager.validateBookmarkConflicts({ showToast: false });
                    }
                }
            });
        });

        const selectCheckbox = div.querySelector('.bookmark-select-checkbox');
        if (selectCheckbox) {
            selectCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedBookmarkIndexes.add(fullIndex);
                } else {
                    this.selectedBookmarkIndexes.delete(fullIndex);
                }
                this.updateBulkSelectionToolbar();
            });
        }

        const iconUploadButton = div.querySelector('.btn-upload-icon');
        const iconFileInput = div.querySelector(`#bookmark-icon-file-${fullIndex}`);
        const iconUrlInput = div.querySelector(`#bookmark-icon-url-${fullIndex}`);
        const iconUrlButton = div.querySelector('.btn-set-icon-url');
        const iconClearButton = div.querySelector('.btn-clear-icon');

        if (iconUploadButton && iconFileInput) {
            iconUploadButton.addEventListener('click', () => iconFileInput.click());
            iconFileInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                await this.uploadBookmarkIconFile(file, bookmark, div);
                e.target.value = '';
            });
        }

        if (iconUrlButton && iconUrlInput) {
            iconUrlButton.addEventListener('click', async () => {
                await this.uploadBookmarkIconFromUrl(iconUrlInput.value, bookmark, div);
            });
            iconUrlInput.addEventListener('keydown', async (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                await this.uploadBookmarkIconFromUrl(iconUrlInput.value, bookmark, div);
            });
        }

        if (iconClearButton) {
            iconClearButton.addEventListener('click', () => this.clearIcon(fullIndex));
        }

        // Initialize custom select for the category dropdown
        const selectElement = div.querySelector('select');
        if (selectElement && typeof CustomSelect !== 'undefined') {
            // Mark as initialized to prevent double initialization
            selectElement.dataset.customSelectInit = 'true';
            new CustomSelect(selectElement);
            const customSelectWrapper = selectElement.closest('.custom-select-wrapper');
            if (customSelectWrapper) {
                customSelectWrapper.classList.add('bookmark-category-select-wrapper');
            }
        }

        return div;
    }

    notify(message, type = 'info') {
        if (window.configManager?.ui?.showNotification) {
            window.configManager.ui.showNotification(message, type);
        }
    }

    async uploadBookmarkIconFile(file, bookmark, bookmarkElement) {
        const formData = new FormData();
        formData.append('icon', file);
        try {
            const response = await fetch('/api/icon', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to upload icon file');
            }
            const result = await response.json();
            bookmark.icon = result.icon || '';
            this.updateIconControls(bookmarkElement);
            const urlInput = bookmarkElement.querySelector('[id^="bookmark-icon-url-"]');
            if (urlInput && bookmark.icon) {
                urlInput.value = `/data/icons/${bookmark.icon}`;
            }
            this.notify('Icon geupload.', 'success');
        } catch (error) {
            this.notify('Upload icon mislukt.', 'error');
        }
    }

    async uploadBookmarkIconFromUrl(iconUrl, bookmark, bookmarkElement) {
        const safeUrl = (iconUrl || '').trim();
        if (!safeUrl) {
            this.notify('Vul een icon URL in.', 'info');
            return;
        }
        try {
            const assigned = await this.tryAssignIconFromRemoteUrl(safeUrl, bookmark, bookmarkElement);
            if (!assigned) {
                throw new Error('Primary icon URL failed');
            }
            this.notify('Icon URL ingesteld.', 'success');
            return;
        } catch (error) {
            const fallbackUrl = this.deriveFaviconFromBookmarkUrl(bookmark?.url);
            if (!fallbackUrl) {
                this.notify('Icon URL ongeldig of geblokkeerd.', 'error');
                return;
            }
            const fallbackAssigned = await this.tryAssignIconFromRemoteUrl(fallbackUrl, bookmark, bookmarkElement);
            if (fallbackAssigned) {
                this.notify('Icon URL faalde, favicon.ico gebruikt.', 'success');
                return;
            }
            this.notify('Icon URL ongeldig of geblokkeerd.', 'error');
        }
    }

    async tryAssignIconFromRemoteUrl(remoteUrl, bookmark, bookmarkElement) {
        const response = await fetch('/api/icon/from-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: remoteUrl })
        });
        if (!response.ok) {
            return false;
        }
        const result = await response.json();
        bookmark.icon = result.icon || '';
        if (!bookmark.icon) {
            return false;
        }
        this.updateIconControls(bookmarkElement);
        const urlInput = bookmarkElement.querySelector('[id^="bookmark-icon-url-"]');
        if (urlInput && bookmark.icon) {
            urlInput.value = `/data/icons/${bookmark.icon}`;
        }
        return true;
    }

    deriveFaviconFromBookmarkUrl(bookmarkUrl) {
        const safeUrl = (bookmarkUrl || '').trim();
        if (!safeUrl) {
            return '';
        }
        try {
            const parsed = new URL(safeUrl);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return '';
            }
            return `${parsed.protocol}//${parsed.host}/favicon.ico`;
        } catch (error) {
            return '';
        }
    }

    updateIconControls(bookmarkElement) {
        if (!bookmarkElement || !bookmarkElement._bookmarkRef) {
            return;
        }
        const bookmark = bookmarkElement._bookmarkRef;
        const iconButton = bookmarkElement.querySelector('.btn-upload-icon');
        if (iconButton) {
            iconButton.classList.toggle('has-icon', Boolean(bookmark.icon));
        }

        const uploadWrap = bookmarkElement.querySelector('.bookmark-icon-upload');
        if (!uploadWrap) {
            return;
        }
        const clearButton = uploadWrap.querySelector('.btn-clear-icon');
        if (clearButton) {
            clearButton.disabled = !bookmark.icon;
        }
        const preview = uploadWrap.querySelector('.bookmark-icon-preview');
        if (preview) {
            preview.classList.toggle('has-icon', Boolean(bookmark.icon));
            if (bookmark.icon) {
                preview.innerHTML = `<img src="/data/icons/${bookmark.icon}" alt="">`;
            } else {
                preview.innerHTML = '<span class="bookmark-icon-preview-empty">No icon</span>';
            }
        }
    }

    /**
     * Initialize bookmark reordering
     * @param {Array} bookmarks
     * @param {Function} onReorder - Callback when reorder happens
     */
    initReorder(bookmarks, onReorder, options = {}) {
        const filterCategory = options.filterCategory || this.currentFilterCategory;

        // Destroy previous instance if it exists
        if (this.bookmarkReorder) {
            this.bookmarkReorder.destroy();
        }

        const container = document.getElementById('bookmarks-list');
        if (!container || container.querySelectorAll('.bookmark-item').length === 0) {
            return;
        }
        
        // Initialize drag-and-drop reordering
        this.bookmarkReorder = new DragReorder({
            container: '#bookmarks-list',
            itemSelector: '.bookmark-item',
            handleSelector: '.js-drag-handle',
            onReorder: (newOrder) => {
                const reorderedScopedBookmarks = [];
                newOrder.forEach((item) => {
                    const bookmark = item.element._bookmarkRef;
                    if (bookmark) {
                        reorderedScopedBookmarks.push(bookmark);
                    }
                });

                if (filterCategory === '__all__') {
                    onReorder(reorderedScopedBookmarks);
                    return;
                }

                const nextBookmarks = [];
                let scopeIndex = 0;
                bookmarks.forEach((bookmark) => {
                    const inScope = (filterCategory === '__none__')
                        ? this.isBookmarkUncategorized(bookmark)
                        : bookmark.category === filterCategory;

                    if (inScope) {
                        nextBookmarks.push(reorderedScopedBookmarks[scopeIndex] || bookmark);
                        scopeIndex += 1;
                    } else {
                        nextBookmarks.push(bookmark);
                    }
                });

                onReorder(nextBookmarks);
            }
        });

        this.setupKeyboardReorder(bookmarks, onReorder, { filterCategory });
    }

    setupKeyboardReorder(bookmarks, onReorder, options = {}) {
        const container = document.getElementById('bookmarks-list');
        if (!container) {
            return;
        }

        if (this.keyboardReorderHandler) {
            container.removeEventListener('keydown', this.keyboardReorderHandler);
        }

        const filterCategory = options.filterCategory || this.currentFilterCategory;

        this.keyboardReorderHandler = (e) => {
            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) {
                return;
            }

            const bookmarkItem = e.target.closest('.bookmark-item');
            if (!bookmarkItem) {
                return;
            }

            const currentIndex = parseInt(bookmarkItem.getAttribute('data-bookmark-index'), 10);
            if (Number.isNaN(currentIndex)) {
                return;
            }

            const scopedIndexes = bookmarks
                .map((bookmark, index) => ({ bookmark, index }))
                .filter(({ bookmark }) => {
                    if (filterCategory === '__all__') {
                        return true;
                    }
                    if (filterCategory === '__none__') {
                        return this.isBookmarkUncategorized(bookmark);
                    }
                    return bookmark.category === filterCategory;
                })
                .map(({ index }) => index);

            const scopedPosition = scopedIndexes.indexOf(currentIndex);
            if (scopedPosition === -1) {
                return;
            }

            const targetPosition = e.key === 'ArrowUp' ? scopedPosition - 1 : scopedPosition + 1;
            if (targetPosition < 0 || targetPosition >= scopedIndexes.length) {
                return;
            }

            e.preventDefault();

            const targetIndex = scopedIndexes[targetPosition];
            const nextBookmarks = [...bookmarks];
            const temp = nextBookmarks[currentIndex];
            nextBookmarks[currentIndex] = nextBookmarks[targetIndex];
            nextBookmarks[targetIndex] = temp;
            onReorder(nextBookmarks, {
                focusIndex: targetIndex,
                highlightIndex: targetIndex
            });
        };

        container.addEventListener('keydown', this.keyboardReorderHandler);
    }

    /**
     * Add a new bookmark
     * @param {Array} bookmarks
     * @returns {Object} - The new bookmark
     */
    add(bookmarks, options = {}) {
        const preferredCategory = options.preferredCategory || '';
        const newBookmark = {
            name: `${this.t('config.newBookmarkPrefix')} ${bookmarks.length + 1}`,
            url: 'https://example.com',
            shortcut: '',
            category: preferredCategory,
            pinned: false,
            checkStatus: false
        };
        bookmarks.push(newBookmark);
        return newBookmark;
    }

    /**
     * Remove a bookmark (with confirmation)
     * @param {Array} bookmarks
     * @param {number} index
     * @returns {Promise<boolean>} - Whether the bookmark was removed
     */
    async remove(bookmarks, index) {
        const confirmed = await window.AppModal.danger({
            title: this.t('config.removeBookmarkTitle'),
            message: this.t('config.removeBookmarkMessage'),
            confirmText: this.t('config.remove'),
            cancelText: this.t('config.cancel')
        });
        
        if (!confirmed) {
            return false;
        }
        
        bookmarks.splice(index, 1);
        this.selectedBookmarkIndexes.delete(index);
        return true;
    }

    getSelectedIndexes() {
        return Array.from(this.selectedBookmarkIndexes).sort((a, b) => a - b);
    }

    clearSelection() {
        this.selectedBookmarkIndexes.clear();
        this.updateBulkSelectionToolbar();
        document.querySelectorAll('.bookmark-select-checkbox').forEach((checkbox) => {
            checkbox.checked = false;
        });
    }

    selectAllVisible() {
        document.querySelectorAll('.bookmark-item').forEach((item) => {
            const index = parseInt(item.getAttribute('data-bookmark-index'), 10);
            const checkbox = item.querySelector('.bookmark-select-checkbox');
            if (!Number.isNaN(index) && checkbox) {
                this.selectedBookmarkIndexes.add(index);
                checkbox.checked = true;
            }
        });
        this.updateBulkSelectionToolbar();
    }

    updateBulkSelectionToolbar() {
        const count = this.selectedBookmarkIndexes.size;
        const bulkDeleteButton = document.getElementById('bulk-delete-bookmarks-btn');
        const bulkToolbar = bulkDeleteButton ? bulkDeleteButton.closest('.bookmarks-toolbar') : null;
        ['bulk-delete-bookmarks-btn', 'bulk-apply-category-btn', 'bulk-toggle-pin-btn', 'bulk-toggle-status-btn', 'bulk-move-page-btn'].forEach((buttonId) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = count === 0;
            }
        });
        if (bulkToolbar) {
            bulkToolbar.classList.toggle('is-active-selection', count > 0);
        }

        const countLabel = document.getElementById('bulk-selection-count');
        if (countLabel) {
            countLabel.textContent = count > 0 ? `${count} selected` : '0 selected';
        }

        const deleteButton = document.getElementById('bulk-delete-bookmarks-btn');
        if (deleteButton) {
            deleteButton.textContent = 'Delete';
        }

        const moveButton = document.getElementById('bulk-apply-category-btn');
        if (moveButton) {
            moveButton.textContent = 'Move category';
        }

        const pinButton = document.getElementById('bulk-toggle-pin-btn');
        if (pinButton) {
            pinButton.setAttribute('aria-disabled', count === 0 ? 'true' : 'false');
        }

        const statusButton = document.getElementById('bulk-toggle-status-btn');
        if (statusButton) {
            statusButton.setAttribute('aria-disabled', count === 0 ? 'true' : 'false');
        }

        const movePageButton = document.getElementById('bulk-move-page-btn');
        if (movePageButton) {
            movePageButton.textContent = 'Move page';
        }
    }

    async bulkDelete(bookmarks) {
        const indexes = this.getSelectedIndexes();
        if (indexes.length === 0) return false;

        const confirmed = await window.AppModal.danger({
            title: 'Delete selected bookmarks',
            message: `Delete ${indexes.length} selected bookmarks?`,
            confirmText: this.t('config.remove'),
            cancelText: this.t('config.cancel')
        });

        if (!confirmed) return false;

        for (let i = indexes.length - 1; i >= 0; i--) {
            bookmarks.splice(indexes[i], 1);
        }
        this.clearSelection();
        return true;
    }

    bulkUpdateCategory(bookmarks, categoryId) {
        this.getSelectedIndexes().forEach((index) => {
            if (bookmarks[index]) {
                bookmarks[index].category = categoryId;
            }
        });
        this.clearSelection();
    }

    bulkTogglePin(bookmarks) {
        this.getSelectedIndexes().forEach((index) => {
            if (bookmarks[index]) {
                bookmarks[index].pinned = !bookmarks[index].pinned;
            }
        });
        this.clearSelection();
    }

    bulkToggleStatus(bookmarks) {
        this.getSelectedIndexes().forEach((index) => {
            if (bookmarks[index]) {
                bookmarks[index].checkStatus = !bookmarks[index].checkStatus;
            }
        });
        this.clearSelection();
    }

    /**
     * Clear the icon from a bookmark
     * @param {number} index - The index of the bookmark to clear the icon from
     */
    clearIcon(index) {
        // Find the bookmark element
        const bookmarkElement = document.querySelector(`[data-bookmark-index="${index}"]`);
        if (!bookmarkElement || !bookmarkElement._bookmarkRef) {
            return;
        }

        const bookmark = bookmarkElement._bookmarkRef;
        const previousIcon = bookmark.icon || '';
        if (!previousIcon) {
            return;
        }
        
        // Clear the icon
        bookmark.icon = '';
        const iconUrlInput = bookmarkElement.querySelector('[id^="bookmark-icon-url-"]');
        if (iconUrlInput) {
            iconUrlInput.value = '';
        }

        this.updateIconControls(bookmarkElement);

        const restore = () => {
            bookmark.icon = previousIcon;
            if (iconUrlInput) {
                iconUrlInput.value = `/data/icons/${previousIcon}`;
            }
            this.updateIconControls(bookmarkElement);
            this.notify('Icon hersteld.', 'success');
        };

        this.pendingIconUndo = { index, restore };
        if (window.configManager?.ui?.showNotification) {
            window.configManager.ui.showNotification('Icon verwijderd.', 'success', {
                actionLabel: 'Undo',
                onAction: () => {
                    if (this.pendingIconUndo && this.pendingIconUndo.index === index) {
                        this.pendingIconUndo.restore();
                        this.pendingIconUndo = null;
                    }
                }
            });
            return;
        }
        this.notify('Icon verwijderd.', 'success');
    }
}

// Export for use in other modules
window.ConfigBookmarks = ConfigBookmarks;
