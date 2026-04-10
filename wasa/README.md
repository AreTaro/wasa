# GAS Registry (Apps Script Packages)

A web application built to run on Google Apps Script (GAS) to serve as a package registry (similar to ELPA/MELPA) for GAS libraries and tools.

## Features
- **Modern UI**: Built with React and TailwindCSS via HTML Service.
- **Form Submissions**: Users can submit new packages or request updates to existing ones.
- **GitLab Integration Ready**: Includes a `ManifestUrl` field in the database, allowing future development of a Time-Driven Trigger to auto-update package descriptions from raw JSON files in GitLab repositories (Idea 1).
- **Backend Database**: Uses the active Google Spreadsheet to store your `Approved` and `Submissions` lists.

## Deployment Instructions

### Method 1: Manual Verification (Easiest)
1. Go to [Google Sheets](https://sheets.new) and create a new Spreadsheet. Name it "GAS Registry DB".
2. Click **Extensions > Apps Script**.
3. In the Apps Script editor:
   - Paste the contents of `Code.js` (from this local directory) into the default `Code.gs` file.
   - Click the **+** (Add a file) button, choose **HTML**, name it exactly `Index` (it will become `Index.html`). Paste the contents of `Index.html` into it.
4. Save the project (Ctrl+S / Cmd+S).
5. **Initialize the database**:
   - Open the `Code.gs` file, select the `initializeRegistry` function from the top toolbar dropdown, and click **Run**.
   - *Note: Google will warn about "Unverified App" and ask for permissions to manage your spreadsheets. Click Advanced > Go to [Project] to approve.*
   - *This command maps the columns across the `Approved` and `Submissions` sheets automatically.*
6. **Deploy the web app**:
   - Click **Deploy** (top right blue button) > **New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: "Initial version"
   - Execute as: **Me** (your google account)
   - Who has access: **Anyone**
   - Click **Deploy**.
7. Copy the generated "Web app URL" and visit it in your browser!

### Method 2: Using CLI (clasp)
If you have node installed and [`clasp`](https://github.com/google/clasp) globally configured:
1. Open your terminal in this directory (`/home/aretaro/study/git/vasa/gas-registry`).
2. Run `clasp login`
3. Run `clasp create --type sheets --title "GAS Registry"` 
4. Run `clasp push`
5. Open the specific spreadsheet created by clasp and follow steps 5-7 from Method 1.

## Managing Submissions
When users submit packages via the beautiful frontend, their entries will populate the `Submissions` sheet.
As the administrator:
1. You can run the `Registry Admin` menu items directly from the Google Sheet toolbar (e.g., `Approve Selected Submissions`).
2. The React app automatically reflects the `Approved` sheet upon next load.

## Developer Instructions (Manifest Formatting)
To enable automatic description updates, contributors should provide a direct **Raw JSON Link** to a metadata file hosted on their repository (e.g. `package.json` or `manifest.json`).

Our backend (`pollManifestUpdates`) expects this file to be a valid JSON object containing at least a `"description"` key at the root level.

**Correct Example (`manifest.json`):**
```json
{
  "name": "your-awesome-package",
  "description": "This text will be automatically synchronized with the registry!",
  "version": "1.0.0"
}
```

**Obtaining the URL:**
- Developers **must** provide the raw link (not the HTML website page).
- On **GitLab**: `https://gitlab.com/<user>/<repo>/-/raw/main/manifest.json`
- On **GitHub**: `https://raw.githubusercontent.com/<user>/<repo>/main/manifest.json`
