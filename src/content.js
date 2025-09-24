// Wrap entire content script in IIFE to prevent global scope pollution and allow early returns
(function() {
    // Check if extension has already been initialized to prevent duplicate processing
    if (window.batmudEssenceEyeInitialized) {
        return;
    }

    // Mark as initialized immediately to prevent race conditions
    window.batmudEssenceEyeInitialized = true;

    // Inject CSS for watched equipment styling (only if not already injected)
    if (!document.querySelector('style[data-batmud-essence-eye]')) {
        const style = document.createElement('style');
        style.setAttribute('data-batmud-essence-eye', 'true');
        style.textContent = `
    .batmud-watched-eq .unnamed-eq-id {
        font-weight: bold;
    }
    .batmud-watch-btn {
        padding: 4px 4px;
        margin: 0;
        font-size: 10px;
        cursor: pointer;
        color: white;
        border: none;
        line-height: 1.2;
        font-weight: normal;
    }
    .batmud-watched-eq .bidder,
    .batmud-watched-eq .unnamed-eq-id{
        background-color: #fce5cd !important;
    }
    .batmud-watched-eq .bidder.batmud-my-bid,
    .batmud-watched-eq .unnamed-eq-id.batmud-my-bid {
        background-color: #b7e1cd !important;
    }
    .batmud-button-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px 20px;
        box-sizing: border-box;
    }
    .batmud-action-btn {
        width: 100%;
        padding: 8px 8px;
        color: #cccccc;
        border: none;
        cursor: pointer;
        font-size: 12px;
    }
    .batmud-action-btn:hover {
        color: white;
    }
    .batmud-watch-my-bids-btn {
        background-color: #5a7a5c;
    }
    .batmud-watch-my-bids-btn:hover {
        background-color: #388e3c;
    }
    .batmud-drop-all-btn {
        background-color: #8a5a5a;
    }
    .batmud-drop-all-btn:hover {
        background-color: #c62828;
    }
`;
        document.head.appendChild(style);
    }

    // Helper function to get ssId from URL
    function getSsIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('s');
    }

    // Helper functions for managing watched equipment IDs
    function getWatchedEqIds(ssId) {
        const stored = localStorage.getItem(`batmud-watched-eq-ids-${ssId}`);
        return stored ? JSON.parse(stored) : [];
    }

    function isEqWatched(ssId, eqId) {
        return getWatchedEqIds(ssId).includes(eqId);
    }

    function addWatchedEqId(ssId, eqId) {
        const watched = getWatchedEqIds(ssId);
        if (!watched.includes(eqId)) {
            watched.push(eqId);
            localStorage.setItem(`batmud-watched-eq-ids-${ssId}`, JSON.stringify(watched));
            updateBadgeCount();
        }
    }

    function removeWatchedEqId(ssId, eqId) {
        const watched = getWatchedEqIds(ssId);
        const index = watched.indexOf(eqId);
        if (index > -1) {
            watched.splice(index, 1);
            localStorage.setItem(`batmud-watched-eq-ids-${ssId}`, JSON.stringify(watched));
            updateBadgeCount();
        }
    }

    function getCurrentUsername() {
        // Find the menu div
        const menuDiv = document.getElementById('menu');
        if (!menuDiv) {
            return null;
        }

        // Find the <a> element with href starting with 'myinfo.php?s='
        const userLink = menuDiv.querySelector('a[href^="myinfo.php?s="]');
        if (!userLink) {
            return null;
        }

        const username = userLink.textContent.trim();
        return username;
    }

    function getTotalWatchedCount() {
        let totalCount = 0;

        // Iterate through all localStorage keys to find all batmud-watched-eq-ids entries
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('batmud-watched-eq-ids-')) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    try {
                        const watchedIds = JSON.parse(stored);
                        if (Array.isArray(watchedIds)) {
                            totalCount += watchedIds.length;
                        }
                    } catch (e) {
                        // Skip invalid JSON entries
                        continue;
                    }
                }
            }
        }

        return totalCount;
    }

    function updateBadgeCount() {
        const totalCount = getTotalWatchedCount();

        // Send message to background script to update badge
        chrome.runtime.sendMessage({
            type: 'updateBadge',
            count: totalCount
        });
    }

    function cleanupStaleWatchedIds(ssId, eqPoolTables) {
        // Get all current equipment IDs from all tables
        const currentIds = [];
        eqPoolTables.forEach(eqPoolTable => {
            const rows = eqPoolTable.querySelectorAll('tbody > tr');
            rows.forEach(row => {
                const unnamedTd = row.querySelector('td.unnamed-eq-id');
                if (unnamedTd) {
                    const eqId = unnamedTd.textContent.trim();
                    currentIds.push(eqId);
                }
            });
        });

        // Get watched IDs and remove any that are no longer in any table
        const watchedIds = getWatchedEqIds(ssId);
        const staleIds = watchedIds.filter(id => !currentIds.includes(id));

        if (staleIds.length > 0) {
            staleIds.forEach(id => removeWatchedEqId(ssId, id));
            // Badge count will be updated by removeWatchedEqId calls
        }
    }

    function createActionButtons(ssId, username) {
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'batmud-button-container';
        buttonContainer.setAttribute('data-batmud-essence-eye', 'true');

        // Create "Watch My Bids" button
        const watchMyBidsBtn = document.createElement('button');
        watchMyBidsBtn.textContent = 'Watch My Bids';
        watchMyBidsBtn.className = 'batmud-action-btn batmud-watch-my-bids-btn';

        watchMyBidsBtn.addEventListener('click', function() {
            // Process ALL equipment tables
            const allTables = document.querySelectorAll('table.eq-pool');
            allTables.forEach(eqPoolTable => {
                const rows = eqPoolTable.querySelectorAll('tbody > tr');
                rows.forEach(row => {
                    const bidderTd = row.querySelector('td.bidder');
                    const unnamedTd = row.querySelector('td.unnamed-eq-id');
                    if (bidderTd && unnamedTd) {
                        const bidder = bidderTd.textContent.trim();
                        if (bidder === username) {
                            const eqId = unnamedTd.textContent.trim();
                            if (!isEqWatched(ssId, eqId)) {
                                addWatchedEqId(ssId, eqId);
                                row.classList.add('batmud-watched-eq');
                                // Update button if it exists
                                if (unnamedTd._button) {
                                    unnamedTd._button.textContent = 'Drop';
                                    unnamedTd._button.style.backgroundColor = '#c62828';
                                }
                            }
                        }
                    }
                });
            });
        });

        // Create "Drop all" button
        const dropAllBtn = document.createElement('button');
        dropAllBtn.textContent = 'Drop all';
        dropAllBtn.className = 'batmud-action-btn batmud-drop-all-btn';

        dropAllBtn.addEventListener('click', function() {
            // Show confirmation dialog
            const watchedCount = getWatchedEqIds(ssId).length;
            if (watchedCount === 0) {
                alert('No watched items to drop.');
                return;
            }

            const confirmMessage = `Are you sure you want to drop all ${watchedCount} watched item${watchedCount > 1 ? 's' : ''}?`;
            if (!confirm(confirmMessage)) {
                return;
            }

            // Process ALL equipment tables
            const allTables = document.querySelectorAll('table.eq-pool');
            allTables.forEach(eqPoolTable => {
                const rows = eqPoolTable.querySelectorAll('tbody > tr');
                rows.forEach(row => {
                    const unnamedTd = row.querySelector('td.unnamed-eq-id');
                    if (unnamedTd) {
                        const eqId = unnamedTd.textContent.trim();
                        if (isEqWatched(ssId, eqId)) {
                            removeWatchedEqId(ssId, eqId);
                            row.classList.remove('batmud-watched-eq');
                            // Update button if it exists
                            if (unnamedTd._button) {
                                unnamedTd._button.textContent = 'Watch';
                                unnamedTd._button.style.backgroundColor = '#388e3c';
                            }
                        }
                    }
                });
            });
        });

        // Add buttons to container
        buttonContainer.appendChild(watchMyBidsBtn);
        buttonContainer.appendChild(dropAllBtn);

        return buttonContainer;
    }

    function setupEquipmentTable(ssId, eqPoolTable, username) {
        // Get all rows in the tbody
        const rows = eqPoolTable.querySelectorAll('tbody > tr');

        // Process each row - add class and create button
        rows.forEach(row => {
            const unnamedTd = row.querySelector('td.unnamed-eq-id');
            if (unnamedTd) {
                const eqId = unnamedTd.textContent.trim();

                // Add watched class if needed
                if (isEqWatched(ssId, eqId)) {
                    row.classList.add('batmud-watched-eq');
                }

                // Check if current user is the winning bidder
                const bidderTd = row.querySelector('td.bidder');
                const bidder = bidderTd ? bidderTd.textContent.trim() : null;
                if (bidderTd && bidder === username) {
                    bidderTd.classList.add('batmud-my-bid');
                    unnamedTd.classList.add('batmud-my-bid');
                }

                // Store original content as cloned nodes
                const originalNodes = Array.from(unnamedTd.childNodes).map(node => node.cloneNode(true));

                // Create button once for this row
                const button = document.createElement('button');
                button.className = 'batmud-watch-btn';
                const updateButton = () => {
                    const isWatched = isEqWatched(ssId, eqId);
                    button.textContent = isWatched ? 'Drop' : 'Watch';
                    button.style.backgroundColor = isWatched ? '#c62828' : '#388e3c';
                };
                updateButton();

                // Add click handler
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (isEqWatched(ssId, eqId)) {
                        removeWatchedEqId(ssId, eqId);
                        row.classList.remove('batmud-watched-eq');
                    } else {
                        addWatchedEqId(ssId, eqId);
                        row.classList.add('batmud-watched-eq');
                    }
                    updateButton();
                });

                // Clear any existing button reference to prevent memory leaks
                if (unnamedTd._button) {
                    unnamedTd._button = null;
                }

                // Store button and original nodes for hover events
                unnamedTd._button = button;
                unnamedTd._originalNodes = originalNodes;

                // Add hover listeners
                let isShowingButton = false;

                row.addEventListener('mouseenter', function() {
                    const td = this.querySelector('td.unnamed-eq-id');
                    if (td && td._button && !isShowingButton) {
                        // Clear content and add button
                        while (td.firstChild) {
                            td.removeChild(td.firstChild);
                        }
                        td.appendChild(td._button);
                        isShowingButton = true;
                    }
                });

                row.addEventListener('mouseleave', function() {
                    const td = this.querySelector('td.unnamed-eq-id');
                    if (td && td._originalNodes && isShowingButton) {
                        // Clear content and restore original nodes
                        while (td.firstChild) {
                            td.removeChild(td.firstChild);
                        }
                        td._originalNodes.forEach(node => {
                            td.appendChild(node.cloneNode(true));
                        });
                        isShowingButton = false;
                    }
                });
            }
        });
    }

    function initializeExtension() {
        // Get ssId from URL
        const ssId = getSsIdFromUrl();
        if (!ssId) {
            return;
        }

        // Remove any existing extension elements from previous loads
        const existingButtons = document.querySelectorAll('[data-batmud-essence-eye="true"]');
        existingButtons.forEach(element => {
            if (element.tagName !== 'STYLE') {
                element.remove();
            }
        });

        // Find current username first
        const username = getCurrentUsername();

        // Find all equipment pool tables
        const eqPoolTables = document.querySelectorAll('table.eq-pool');

        if (eqPoolTables.length > 0) {
            // Add action buttons after the menu
            const menu = document.querySelector('div#menu > div.pure-menu');
            if (menu) {
                const actionButtons = createActionButtons(ssId, username);
                menu.parentNode.insertBefore(actionButtons, menu.nextSibling);
            }

            // Clean up stale watched IDs first using all tables
            cleanupStaleWatchedIds(ssId, eqPoolTables);

            // Then process each table
            eqPoolTables.forEach(eqPoolTable => {
                setupEquipmentTable(ssId, eqPoolTable, username);
            });

            // Update badge count after initialization
            updateBadgeCount();
        }
    }

    // Initialize extension based on document ready state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeExtension);
    } else {
        initializeExtension();
    }
})();
