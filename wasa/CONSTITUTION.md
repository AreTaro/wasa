# Apps Script Registry Constitution

Welcome to the Apps Script Package Registry governance document. This constitution defines the core rules for submitting, validating, and managing packages within the registry, ensuring security and stability for our enterprise environment.

## Article I: Mission & Purpose
The Registry exists to provide a centralized, secure, and searchable index of reusable Google Apps Script packages and libraries for internal enterprise developers.

## Article II: Submission Rules
To apply for a package listing, developers must adhere to the following strict guidelines:
1. **Domain Identity Requirement**: All submission requests must be executed using a valid organization email address. External submissions from unknown or generic email addresses are automatically rejected.
2. **Mandatory Metadata**: Packages must provide:
   - A descriptive and distinct *Package Name*
   - A clear *Description* of its core utility
   - A reliable *Repository URL* or *Documentation Manual URL*
3. **Auto-Polling Manifest (Optional but Encouraged)**: Submissions defining a `ManifestUrl` to auto-sync their descriptions must host the raw JSON on trusted code repositories (e.g., `gitlab.com`, `githubusercontent.com`, `script.google.com`).

## Article III: Validation & Review Process
The Administration team pledges to independently verify packages before they are synchronized with the live central index.
1. **Security Isolation**: Submissions land directly into the sandboxed `Submissions` sheet. The data is inaccessible to the frontend public catalog until explicitly verified and exported.
2. **Spoofing Verification**: Administrators will reject packages suspected of spoofing organizational emails. Status update emails will *only* route to verified internal addresses to inherently prevent spam proxying.
3. **Safe Evaluation**: Security sanitization protocols enforce plain-text mapping on all submissions. Any submissions attempting to bypass fields using active spreadsheet formulas (e.g., csv injection vectors) are defused and grounds for immediate rejection.

## Article IV: Directory Management (Approved vs. Archive)
1. **The Active Database (`Approved`)**: Packages residing here dictate the entirety of the live application catalog and populate the `Index.html` frontend.
2. **Archival (`Archive`)**: Packages that are deprecated, unmaintained, or superseded must be explicitly moved to the `Archive` sheet via the exclusive *Registry Admin Menu*, preserving their historical IDs and timestamps permanently while expunging them from public access.
3. **Restoration**: Should an archived package be revived, Administrators must utilize the `Restore Archived Packages` function to safely return the package to the active index.

## Article V: Platform & Script Governance
The source code executing this Registry operates strictly under an Enterprise architectural boundary.
1. Core security functions—specifically the `ALLOWED_MANIFEST_DOMAINS` variable, strict `sanitizeCell` injections, and the 60-second `CacheService` cooldowns—are immutable foundation protections and must not be bypassed.
2. Web Application versioning functions identically to a 'Permanent Freeze'. Any administrative update to `Code.js` encompassing a newly defined OAuth scope in `appsscript.json` demands a synchronized **New Deployment** execution within Apps Script to update the live user `/exec` endpoint.
