# Transaction Rule Engine Prototype

This demo is now focused on a rule-first workflow for transaction parsing and categorization.

## What It Can Do

- Configure bill formats manually
  - bill type name
  - encoding (`UTF-8` or `GB2312`)
  - header line number
  - field mapping for:
    - Transaction time
    - Transaction category
    - Transaction type
    - Counterpart name
    - Description
    - Amount
    - Source
    - Transaction status
- Import a real CSV bill and preview the detected header row
- Parse WeChat Pay and Alipay bills with editable presets
- Review parsed transactions row by row
- Correct a category manually
- Turn a correction into a reusable rule
- Use multiple matcher types
  - `Contains`
  - `Keyword AND`
  - `Keyword OR`
  - `Exact match`
  - `Wildcard (* ?)`
  - `Regex`
- Persist bill configs, categories, and rules in local storage

## Included Starter Rules

The prototype ships with a few example rules for the kind of Meituan misclassification discussed in the project notes:

- `先骑后付` -> `Transport`
- `曹操惠选 / 享道经济型 / T3特惠` under Meituan -> `Transport`
- `充电宝 / 共享充电宝 / 免押租借` -> `Everyday Item`

## Preset Defaults

- WeChat Pay
  - encoding: `UTF-8`
  - header line: `17`
- Alipay
  - encoding: `GB2312`
  - header line: `25`

The attached Alipay sample in this repo context parsed correctly with header line `25`. If another export lands on a different line, just change the number in the UI and re-import.

## Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Validation used during implementation:

```bash
npm run build
npm run lint
```

`npm run lint` currently passes with existing shadcn fast-refresh warnings only.
