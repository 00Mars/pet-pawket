# Stylelint Setup (Pet Pawket)

This folder contains a ready-to-drop Stylelint configuration for Pet Pawket.

## Files
- `.stylelintrc.json` — ruleset (extends `stylelint-config-standard`, adds property ordering and sane defaults)
- `.stylelintignore` — ignores vendor, dist, minified bundles, and explicit `legacy` paths
- `package.json` snippet — devDeps and scripts to lint/fix

## Install
```bash
npm i -D stylelint stylelint-config-standard stylelint-order
```

## Add scripts to your root `package.json`
```jsonc
"scripts": {
  "lint:css": "stylelint \"**/*.css\"",
  "lint:css:fix": "stylelint \"**/*.css\" --fix"
}
```

## Run
```bash
npm run lint:css
npm run lint:css:fix
```

> Tip: Install the Stylelint VS Code extension for inline feedback while editing.