# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BatMUD Essence Eye is a Chrome/Firefox browser extension for watching BatMUD SS EQ bidding.
It's a Manifest V3 extension that injects content scripts into the BatMUD SS equipment pool page.

## Architecture

The extension consists of:
- **src/manifest.json**: Extension configuration with permissions for bat.org/ss/pool.php
- **src/content.js**: Injected into pool.php pages to add watch/drop buttons, track watched items, and highlight user's bids
- **src/background.js**: Service worker that handles badge updates and opens pool.php when extension icon is clicked
- **src/assets/**: Directory containing extension icons and BatMUD logo image

## Development Commands

### Setup
```bash
npm install  # Install development dependencies (web-ext)
```

### Development with web-ext (Recommended)
```bash
npm run dev:firefox  # Launch Firefox with extension loaded
npm run dev:chrome   # Launch Chrome/Chromium with extension loaded
npm run lint         # Lint the extension for issues
npm run build        # Build extension package to dist/ directory
```

### Manual Chrome Development
1. Load extension: Navigate to `chrome://extensions/`, enable Developer mode, click "Load unpacked", select the `src` directory
2. Reload extension: Click refresh icon on extension card in chrome://extensions/
3. View console logs: Open DevTools on pool.php page for content script logs, or chrome://extensions/ → Service Worker link for background script logs

### Manual Firefox Development
1. Load extension: Navigate to `about:debugging`, click "This Firefox", click "Load Temporary Add-on", select `src/manifest.json`
2. Reload extension: Click "Reload" button in about:debugging
3. View console logs: Use Browser Console (Ctrl+Shift+J) for extension logs

## Testing

Test the extension by:
1. Loading it in your browser
2. Navigating to https://www.bat.org/ss/pool.php?s=3 (or any SS number)
3. Hover over equipment IDs to see Watch/Drop buttons appear
4. Click "Watch My Bids" to watch all items you're currently bidding on
5. Verify the extension badge shows the count of watched items
6. Click the extension icon to open a new tab with the pool page

## Key Implementation Notes

- The extension tracks watched equipment IDs per SS session using localStorage
- Watched items are highlighted with an orange background (#fce5cd)
- Items where the user is the current bidder get a green background (#b7e1cd)
- The badge count shows total watched items across all SS sessions
- Content script runs at document_end to ensure DOM is fully loaded
- Watch/Drop buttons appear on hover for each equipment row
- "Watch My Bids" and "Drop all" action buttons are placed after the menu
- Clicking the extension icon opens https://www.bat.org/ss/pool.php?s=3 in a new tab
- The extension automatically cleans up watched IDs that no longer exist in the current pool
