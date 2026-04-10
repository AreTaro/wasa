/**
 * GAS-REGISTRY Backend Code
 * Google Apps Script handling Spreadsheet database and React Frontend delivery.
 */

// Global App Settings
const SETTINGS = {
  APPROVED_SHEET: "Approved",
  SUBMISSION_SHEET: "Submissions",
  APP_TITLE: "Apps Script Registry",
  ALLOWED_MANIFEST_DOMAINS: ["gitlab.com", "raw.githubusercontent.com", "script.google.com"]
};

// Security Helpers
function sanitizeCell(val) {
  if (typeof val === 'string' && /^[=+\-@]/.test(val)) return "'" + val;
  return val;
}

function getOrgDomain() {
  const email = Session.getEffectiveUser().getEmail();
  return email ? email.split('@')[1] : null;
}

/**
 * Automatically fetches the GitLab/GitHub manifest URL for all approved packages
 * and updates their descriptions if they have changed.
 * You should set this to run automatically (e.g., once a day) using Apps Script Triggers.
 */
function pollManifestUpdates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SETTINGS.APPROVED_SHEET);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return; // Only headers
  
  let updatesCount = 0;

  // Start from 1 to skip headers
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const packageId = row[0];
    const manifestUrl = row[6]; // Column G (Index 6)
    const currentDescription = row[2]; // Column C
    
    // If there is an auto-update URL
    if (manifestUrl && manifestUrl.startsWith("http")) {
      const isAllowed = SETTINGS.ALLOWED_MANIFEST_DOMAINS.some(domain => manifestUrl.includes(domain));
      if (!isAllowed) {
        Logger.log(`Skipping manifest fetch for ${packageId} due to unapproved domain.`);
        continue;
      }
      try {
        // Fetch the raw JSON from the URL
        const response = UrlFetchApp.fetch(manifestUrl, {muteHttpExceptions: true});
        
        if (response.getResponseCode() === 200) {
          const manifest = JSON.parse(response.getContentText());
          
          // Check if the description in the JSON is different from the sheet
          if (manifest.description && manifest.description !== currentDescription) {
            
            // Update the description in the sheet (Column C)
            sheet.getRange(i + 1, 3).setValue(manifest.description);
            // Update the "LastUpdated" timestamp (Column J)
            sheet.getRange(i + 1, 10).setValue(new Date());
            
            updatesCount++;
            Logger.log(`Updated package ${packageId} from manifest.`);
          }
        }
      } catch (e) {
        Logger.log(`Failed to fetch manifest for ${packageId}: ${e.toString()}`);
      }
    }
  }
  Logger.log(`Polling complete. Updated ${updatesCount} packages.`);
}

/**
 * Run this function once from the Apps Script Editor 
 * to initialize the necessary Spreadsheet sheets.
 * It also triggers the authorization flow for Emails if not already granted.
 */
function initializeRegistry() {
  // Force Apps Script to recognize the MailApp dependency for authorization
  try {
    MailApp.getRemainingDailyQuota();
  } catch (e) { }

  const doc = SpreadsheetApp.getActiveSpreadsheet();

  if (!doc.getSheetByName(SETTINGS.APPROVED_SHEET)) {
    const sheet = doc.insertSheet(SETTINGS.APPROVED_SHEET);
    sheet.appendRow(["ID", "Name", "Description", "WebAppUrl", "ManualUrl", "RepoUrl", "ManifestUrl", "SubmitterEmail", "DateAdded", "LastUpdated"]);
    sheet.setFrozenRows(1);
    Logger.log("Created Approved sheet");
  }

  if (!doc.getSheetByName(SETTINGS.SUBMISSION_SHEET)) {
    const sheet = doc.insertSheet(SETTINGS.SUBMISSION_SHEET);
    sheet.appendRow(["Timestamp", "Type", "PackageID", "Name", "Description", "WebAppUrl", "ManualUrl", "RepoUrl", "ManifestUrl", "SubmitterEmail", "Status"]);
    sheet.setFrozenRows(1);
    Logger.log("Created Submissions sheet");
  }

  Logger.log("Initialization complete!");
}

/**
 * Serves the React frontend.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');

  // Inject package data into the template to avoid extra roundtrips
  const packages = getApprovedPackages();
  template.initialData = JSON.stringify(packages).replace(/</g, '\\x3c');

  return template.evaluate()
    .setTitle(SETTINGS.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Handles incoming POST requests from external clients (optional).
 * Most frontend interaction will use processClientSubmission via google.script.run
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'submitNew') {
      return JSON.stringify(handleSubmission(data.payload, 'New'));
    } else if (action === 'submitUpdate') {
      return JSON.stringify(handleSubmission(data.payload, 'Update'));
    }

    return JSON.stringify({ status: 'error', message: 'Unknown action' });
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Expose for client-side google.script.run
 * Because Apps Script prevents easy CORS POST to webapp URLs from inside HTML
 */
function processClientSubmission(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    const action = data.action;
    let res;

    if (action === 'submitNew') {
      res = handleSubmission(data.payload, 'New');
    } else if (action === 'submitUpdate') {
      res = handleSubmission(data.payload, 'Update');
    } else {
      res = handleSubmission(data.payload, 'Unknown');
    }

    // Return stringified JSON payload to client 
    return JSON.stringify(res);
  } catch (e) {
    return JSON.stringify({ status: 'error', message: e.toString() });
  }
}

/**
 * Retrieves all approved packages from the spreadsheet.
 */
function getApprovedPackages() {
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = doc.getSheetByName(SETTINGS.APPROVED_SHEET);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // Only headers

    const headers = data.shift(); // Remove and store headers

    // Convert rows to objects
    return data.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        // Exclude internal email from public API payload
        if (header !== 'SubmitterEmail') {
          obj[header] = row[index] || "";
        }
      });
      return obj;
    }).filter(pkg => pkg.Name && pkg.Name.toString().trim() !== ""); // Filter empty rows
  } catch (e) {
    Logger.log("Error getting packages: " + e.toString());
    return [];
  }
}

/**
 * Appends a new submission to the Submissions sheet.
 */
function handleSubmission(payload, type) {
  // 1. Rate Limiting (DoS Mitigation) based on active user
  const userCache = CacheService.getUserCache();
  if (userCache) {
    const submitCount = parseInt(userCache.get("submit_count") || "0", 10);
    if (submitCount > 10) {
      return { status: 'error', message: 'Too many submissions. Please wait a minute and try again.' };
    }
    userCache.put("submit_count", (submitCount + 1).toString(), 60);
  }

  // 2. Domain verification (Email spoofing mitigation)
  const orgDomain = getOrgDomain();
  const userEmail = payload.email || "";
  if (orgDomain && userEmail && userEmail.split('@')[1] !== orgDomain) {
    return { status: 'error', message: `Email must belong to the ${orgDomain} organization domain.` };
  }

  // 3. SSRF Check on Manifest URL
  if (payload.manifestUrl) {
    const isAllowed = SETTINGS.ALLOWED_MANIFEST_DOMAINS.some(domain => payload.manifestUrl.includes(domain));
    if (!isAllowed) {
      return { status: 'error', message: 'Manifest URL must be hosted on gitlab.com or raw.githubusercontent.com' };
    }
  }

  const doc = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = doc.getSheetByName(SETTINGS.SUBMISSION_SHEET);

  const timestamp = new Date();
  const packageId = payload.id || Utilities.getUuid(); // Generate ID for new packages

  // 4. Sanitize inputs to avert Spreadsheet injection
  const safeRow = [
    timestamp,
    type,
    packageId,
    payload.name || "",
    payload.description || "",
    payload.webAppUrl || "",
    payload.manualUrl || "",
    payload.repoUrl || "",
    payload.manifestUrl || "",
    payload.email || "",
    "Pending"
  ].map(sanitizeCell);

  sheet.appendRow(safeRow);

  return {
    status: 'success',
    message: `Your ${type.toLowerCase()} request has been submitted and is pending review.`
  };
}

/**
 * Admin Menu for Spreadsheet editor
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Registry Admin')
    .addItem('Approve Selected Submissions', 'approveSelectedUi')
    .addItem('Reject Selected Submissions', 'rejectSelectedUi')
    .addToUi();
}

/**
 * Loop through highlighted rows in the Submissions sheet,
 * moves them to the Approved sheet (handling New vs Update logic),
 * and deletes them from the Submissions sheet.
 */
function approveSelectedUi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const subSheet = ss.getSheetByName(SETTINGS.SUBMISSION_SHEET);
  const appSheet = ss.getSheetByName(SETTINGS.APPROVED_SHEET);

  if (ss.getActiveSheet().getName() !== SETTINGS.SUBMISSION_SHEET) {
    ui.alert("Error", "Please run this from the Submissions sheet.", ui.ButtonSet.OK);
    return;
  }

  const range = subSheet.getActiveRange();
  const startRow = range.getRow();
  const numRows = range.getNumRows();

  if (startRow <= 1) {
    ui.alert("Error", "Please select valid submission rows (not headers).", ui.ButtonSet.OK);
    return;
  }

  const values = subSheet.getRange(startRow, 1, numRows, subSheet.getLastColumn()).getValues();

  let approvedCount = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const type = row[1]; // Type (New/Update)
    const packageId = row[2]; // PackageID

    // Map Submission row to Approved row format:
    // [ID, Name, Description, WebAppUrl, ManualUrl, RepoUrl, ManifestUrl, SubmitterEmail, DateAdded, LastUpdated]

    if (type === 'New') {
      appSheet.appendRow([
        packageId, row[3], row[4], row[5], row[6], row[7], row[8], row[9], new Date(), ""
      ]);
    } else if (type === 'Update') {
      // Find row in Approved sheet to update
      const appData = appSheet.getDataRange().getValues();
      let rowIndexToUpdate = -1;
      for (let r = 1; r < appData.length; r++) { // Skip header
        if (appData[r][0] === packageId) {
          rowIndexToUpdate = r + 1; // +1 because array is 0-indexed and sheet is 1-indexed
          break;
        }
      }

      if (rowIndexToUpdate !== -1) {
        // Update the row (keep original DateAdded, update LastUpdated)
        const origDateAdded = appData[rowIndexToUpdate - 1][8];
        appSheet.getRange(rowIndexToUpdate, 1, 1, 10).setValues([[
          packageId, row[3], row[4], row[5], row[6], row[7], row[8], row[9], origDateAdded, new Date()
        ]]);
      } else {
        Logger.log("Update requested for PackageID " + packageId + " but it was not found in Approved sheet.");
        ui.alert("Warning", "Package ID " + packageId + " not found for update. Skipping.", ui.ButtonSet.OK);
        continue; // skip deletion
      }
    }

    // Attempt sending basic confirmation email
    try {
      const userEmail = String(row[9] || "").trim();
      const orgDomain = getOrgDomain();
      if (userEmail && userEmail.indexOf("@") !== -1 && userEmail.indexOf(".") !== -1) {
        if (orgDomain && userEmail.split('@')[1] !== orgDomain) {
          Logger.log("Skipping email: Domain mismatch -> " + userEmail);
        } else {
          const subject = "Apps Script Registry: Package " + (type === 'New' ? "Approved" : "Updated");
          const body = "Your package submission for '" + row[3] + "' has been approved and is now live on the registry!\n\nThank you for contributing.";
          MailApp.sendEmail({ to: userEmail, subject: subject, body: body });
        }
      } else {
        Logger.log("Skipping email: invalid address -> " + row[9]);
      }
    } catch (e) {
      ui.alert("Email Delivery Error", "Package moved, but failed to email " + row[9] + "\n\nError details: " + e.toString(), ui.ButtonSet.OK);
      Logger.log("Email error: " + e.toString());
    }

    approvedCount++;
  }

  // Delete rows from bottom to top to preserve index integrity
  for (let i = numRows - 1; i >= 0; i--) {
    subSheet.deleteRow(startRow + i);
  }

  ui.alert("Success", approvedCount + " packages processed and moved.", ui.ButtonSet.OK);
}

/**
 * Simply deletes the highlighted rows if rejected.
 */
function rejectSelectedUi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const subSheet = ss.getSheetByName(SETTINGS.SUBMISSION_SHEET);

  if (ss.getActiveSheet().getName() !== SETTINGS.SUBMISSION_SHEET) {
    ui.alert("Error", "Please run this from the Submissions sheet.", ui.ButtonSet.OK);
    return;
  }

  const range = subSheet.getActiveRange();
  const startRow = range.getRow();
  const numRows = range.getNumRows();

  if (startRow <= 1) {
    ui.alert("Error", "Please select valid submission rows (not headers).", ui.ButtonSet.OK);
    return;
  }

  const response = ui.alert("Confirm Reject", "Are you sure you want to permanently delete these " + numRows + " submissions?", ui.ButtonSet.YES_NO);
  if (response == ui.Button.YES) {
    const values = subSheet.getRange(startRow, 1, numRows, subSheet.getLastColumn()).getValues();

    // Delete rows from bottom to top to preserve index integrity
    for (let i = numRows - 1; i >= 0; i--) {
      const row = values[i];

      // Attempt to send rejection email
      try {
        const userEmail = String(row[9] || "").trim();
        const orgDomain = getOrgDomain();
        if (userEmail && userEmail.indexOf("@") !== -1 && userEmail.indexOf(".") !== -1) {
          if (orgDomain && userEmail.split('@')[1] !== orgDomain) {
            Logger.log("Skipping email: Domain mismatch -> " + userEmail);
          } else {
            const subject = "Apps Script Registry: Package Rejected";
            const body = "Unfortunately, your package submission for '" + row[3] + "' was not approved for the registry at this time. Please ensure the links work and the description is clear.";
            MailApp.sendEmail({ to: userEmail, subject: subject, body: body });
          }
        }
      } catch (e) {
        ui.alert("Email Delivery Error", "Package deleted, but failed to email " + row[9] + "\n\nError details: " + e.toString(), ui.ButtonSet.OK);
        Logger.log("Email error: " + e.toString());
      }

      subSheet.deleteRow(startRow + i);
    }
  }
}
