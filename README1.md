# AnupExpense Tracker

Offline-first personal expense tracker with PIN lock, cycle reset/history, and backup export.

## Features

- Offline-first PWA (works without internet after first load)
- PIN-based access (4-6 digits, stored as SHA-256 hash)
- Daily entry input: date + remaining amount
- Automatic calculation:
  - Expenditure = previous day remaining - current day remaining
  - Daily average expenditure = total expenditure / number of cycle days
  - Highest spend and highest balance in current cycle
- Cycle reset to move current cycle into history
- Profile metrics:
  - Highest spend ever
  - Highest balance ever
  - Past cycle summaries
- Backup export:
  - JSON full backup
  - CSV history export

## Data Storage

Data is stored locally in browser storage (`localStorage`) under key `anup_expense_tracker_v1`.

## Run Locally (Desktop)

1. Serve the project directory with any static server. Example with Node:

```bash
npx serve .
```

2. Open the local URL shown in terminal (for example `http://localhost:3000`).
3. On first run, create a PIN.

## Install as App (PWA)

1. Open in Chrome/Edge.
2. Use browser "Install app" option from address bar/menu.
3. Launch from desktop/start menu like a native app.

## Android Installation

1. Host the app locally on your machine (`npx serve .`) and open from your Android browser on same network, or deploy static files to any host.
2. Open app URL in Chrome on Android.
3. Tap menu -> "Add to Home screen" / "Install app".
4. App then works offline after first install/load.

## Usage

1. Unlock with PIN.
2. Add daily date + remaining amount.
3. Review live metrics and current-cycle table.
4. Press "Reset Cycle" to archive current cycle into history.
5. Use export buttons for backup files.

## Notes

- This implementation uses Option A from your blueprint (local JSON-like storage in browser).
- To migrate to SQLite + Express later, keep the same data shape and replace localStorage calls with API calls.
