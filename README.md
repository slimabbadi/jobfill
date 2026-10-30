# Jobfill

Fills job applications from details you save once, and keeps a board of every job you
applied to. No AI, no account, no server, no weekly limit. Everything stays in your browser.

## Install (Chrome, Edge, Brave)

1. `pnpm install`, then `pnpm build`
2. Open `chrome://extensions` and turn on **Developer mode** (top right)
3. Click **Load unpacked** and pick the `.output/chrome-mv3` folder
4. The dashboard opens on the Profile page. Fill in your details and add your resume.

After `pnpm build` again, click the reload icon on Jobfill's card in `chrome://extensions`.

Firefox: `pnpm build:firefox`, then load `.output/firefox-mv2/manifest.json` from
`about:debugging` → This Firefox → Load Temporary Add-on (it unloads when Firefox closes).

## On/off switch

Use the **Jobfill on/off** switch in the toolbar popup to pause autofill, the keyboard
shortcut, automatic tracking, saved-answer learning, and page controls across all tabs.
The setting persists across browser restarts. Your dashboard and saved data remain
available, and scheduled backups continue. Turn it on again to resume without reloading.

## Using it

- **Fill:** on an application form, click **Fill application** at the bottom right, press
  `Alt+Shift+F`, or use the toolbar popup. Filled fields get a green outline. Required
  fields it couldn't answer get an amber one. It never submits for you.
- **Side panel:** the **Jobfill** tab on the right edge of every page opens a panel that
  lists the page's fields: missing from your profile, no saved answer, ready to fill, and
  already filled. Edit any of them in place (profile values, saved answers, resume and
  cover letter), click **Show** to jump to a field, or **Fill empty fields**. The tab can
  be hidden in Backup and settings. Fields inside embedded frames aren't listed.
- **German and English:** labels are matched in both languages (Vorname, PLZ, Ort,
  Gehaltsvorstellung, Kündigungsfrist, Deutschkenntnisse...), Ja/Nein answers, German
  date formats, and German ATSs (Personio, softgarden, JOIN, Recruitee, onlyfy, d.vinci,
  rexx, SuccessFactors and more), including ones running on a company's own domain.
- **Tracking:** filling a form puts the job on your board as *Filled, not sent*. Clicking
  the form's Submit button, or reaching a "thank you for applying" page, moves it to
  *Applied*. Drag cards between columns as things move along, or add a job by its link.
- **Saved answers:** when you submit, answers you typed to questions your profile
  doesn't cover ("How did you hear about us?") are saved and reused on the next form.
  Edit or delete them on the Saved answers page.
- **Already applied:** opening a posting you already applied to shows a notice.

## Backups

Uninstalling the extension deletes its data. Jobfill saves a backup file every week to
`Downloads/jobfill-backups/`, and **Backup and settings** has export, restore and CSV.

## Development

```
pnpm dev         # Chrome with live reload
pnpm test        # field matching and job detection tests
pnpm typecheck
```

The fill logic is in `src/lib/fill.ts` (finding fields, reading labels, setting values)
and `src/lib/fields.ts` (which label means which profile field). To support a new
wording, add to the rules in `fields.ts` and a case to `tests/fill.test.ts`.
