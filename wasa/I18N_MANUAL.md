# Internationalization (i18n) Manual for GAS Registry

This manual details how to modify the GAS Registry application to support a language other than English. You have two primary options: **Static Translation** (replacing the English text entirely) or **Dynamic Internationalization** (allowing users to switch between multiple languages).

---

## Option 1: Static Translation (Simplest)

If you only need the application to be in one specific language (e.g., Japanese, French, Spanish) and don't need English at all, the simplest approach is to manually replace the hardcoded English strings in the source code.

### 1. Frontend (`Index.html`)

Open `Index.html` and search for user-facing text inside the HTML and React components. You will need to translate text in the following areas:
- **Headers & Titles:** `GAS Registry`, `Central Package Hub`, `Google Apps Script Package Registry`
- **Buttons:** `Submit Package`, `Submit`, `Cancel`, `Send Update Request`
- **Table Headers:** `Package`, `Description`, `Links`, `Action`
- **Placeholders & Labels:** `Search packages...`, `Package Name`, `Author / Submitter Email`
- **Alerts & Empty States:** `No packages found`, `Try adjusting your search...`, `Submitting...`, `Success!`

**Example (Translating to French):**
```diff
- <h1 className="text-2xl font-bold tracking-tight text-white leading-none">GAS Registry</h1>
+ <h1 className="text-2xl font-bold tracking-tight text-white leading-none">Registre GAS</h1>
```

### 2. Backend (`Code.js`)

Open `Code.js` and translate the text returned to the frontend or sent via email. 
> [!WARNING]
> Do not change internal code keys, variables, or statuses (like `action`, `submitNew`, `status: 'success'`, `Pending`) as these are required for the application logic to function correctly.

**Areas to modify:**
- **Email Subjects & Bodies:** Inside `approveSelectedUi()` and `rejectSelectedUi()`.
- **Alerts/Toasts:** Messages returned inside `handleSubmission()`, `approveSelectedUi()`, etc.
- **Spreadsheet UI Menus:** The menu names in `onOpen()` (e.g., `Registry Admin`, `Approve Selected Submissions`).
- **Spreadsheet Sheet Names:** In `SETTINGS`, you can translate `APPROVED_SHEET`, `SUBMISSION_SHEET`, and `ARCHIVE_SHEET`. **Important:** If you change these on an already active installation, you must manually rename the corresponding tabs in your Google Spreadsheet to match.

**Example (Translating a backend message):**
```diff
- return { status: 'error', message: 'Too many submissions. Please wait a minute and try again.' };
+ return { status: 'error', message: 'Trop de soumissions. Veuillez patienter une minute et réessayer.' };
```

---

## Option 2: Dynamic Internationalization (Recommended for Multi-Language Support)

If you want the application to support English *and* other languages natively, you should implement a translation dictionary system in React.

### Step 1: Create a Translation Dictionary in `Index.html`

Inside the `<script type="text/babel">` block, immediately before the `App` component definition, create a dictionary of translations:

```javascript
const TRANSLATIONS = {
  en: {
    appTitle: "GAS Registry",
    subtitle: "Central Package Hub",
    searchPlaceholder: "Search packages...",
    submitBtn: "Submit Package",
    tablePackage: "Package",
    // Add all other necessary UI strings here...
  },
  fr: {
    appTitle: "Registre GAS",
    subtitle: "Hub Central de Paquets",
    searchPlaceholder: "Rechercher des paquets...",
    submitBtn: "Soumettre un paquet",
    tablePackage: "Paquet",
    // Add all other necessary UI strings here...
  }
};
```

### Step 2: Add Language State to the App

Inside the `App` component, add a state variable to track the user's active language and create a helper variable `t` to easily access the strings.

```javascript
const App = () => {
  const [lang, setLang] = useState('en'); // Set 'en' as default language
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en']; // Fallback to 'en'
  
  // ... existing state variables (packages, searchTerm, etc.)
```

### Step 3: Replace Hardcoded Strings

Go through the JSX return block at the bottom of the `App` component and replace all hardcoded English text with references to the `t` object.

```diff
- <h1 className="text-2xl font-bold tracking-tight text-white leading-none">GAS Registry</h1>
- <p className="text-xs text-brand-100 mt-1 font-medium tracking-wide">Central Package Hub</p>
+ <h1 className="text-2xl font-bold tracking-tight text-white leading-none">{t.appTitle}</h1>
+ <p className="text-xs text-brand-100 mt-1 font-medium tracking-wide">{t.subtitle}</p>
```

### Step 4: Add a Language Switcher UI

Add a dropdown menu in the header (e.g., next to the Search bar or Submit button) to let users toggle the language dynamically.

```jsx
<select 
  value={lang} 
  onChange={(e) => setLang(e.target.value)}
  className="bg-brand-600 text-white border border-transparent hover:border-brand-400 rounded-xl px-3 py-2 outline-none cursor-pointer"
>
  <option value="en">English</option>
  <option value="fr">Français</option>
</select>
```

### Step 5: Handling Backend Messages (`Code.js`)

For backend feedback messages (like success/error toasts after form submission), the backend needs to know the user's language.

1. **Pass Language to Backend:** Update `handleFormSubmit` in `Index.html` to pass the selected language to `Code.js`:
   ```javascript
   const payload = { ...formData, id: modalMode === 'Update' ? selectedPkg.ID : undefined, lang: lang };
   ```

2. **Return Localized Messages:** Update `handleSubmission` in `Code.js` to read `payload.lang` and return the translated string:
   ```javascript
   function handleSubmission(payload, type) {
     const t = payload.lang === 'fr' ? 
       { 
         success: `Votre demande a été soumise.`,
         errorLimit: `Trop de soumissions.`
       } : 
       { 
         success: `Your request has been submitted.`,
         errorLimit: `Too many submissions.`
       };
     
     // ... logic ...
     
     return { status: 'success', message: t.success };
   }
   ```

> [!NOTE]
> Emails sent to users (e.g., rejection/approval emails) are triggered manually by an Admin from the Google Sheet UI, meaning they run in the Admin's Google Session without knowing the submitter's original UI language. You may choose to send these emails in a single default language, or include dual-language text in the email body.
