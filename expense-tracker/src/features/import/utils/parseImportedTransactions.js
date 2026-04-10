function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  const safeLine = String(line || '').replace(/\r$/, '');

  for (let index = 0; index < safeLine.length; index += 1) {
    const char = safeLine[index];
    const nextChar = safeLine[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values.map((value) => value.replace(/^"|"$/g, ''));
}

function findMappedCategory(categories, sourceCategory) {
  return (
    categories.find(
      (category) =>
        normalize(category.name).includes(normalize(sourceCategory)) ||
        normalize(sourceCategory).includes(normalize(category.name))
    ) || null
  );
}

function parseAmount(value) {
  const cleanValue = String(value || '')
    .replace(/[¥￥,\s]/g, '')
    .replace(/[^\d.-]/g, '');
  const parsedValue = Number.parseFloat(cleanValue);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function findDataStartIndex(lines, headerMatchers, fallbackIndex) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (headerMatchers.every((matcher) => line.includes(matcher))) {
      return index + 1;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
      return index;
    }
  }

  return fallbackIndex;
}

export function parseAlipayCsv(text, categories) {
  const lines = String(text || '').split('\n');
  const dataStartIndex = findDataStartIndex(lines, ['交易时间', '收/支'], 23);
  const transactions = [];

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }

    const fields = parseCsvLine(line);
    if (fields.length < 6) {
      continue;
    }

    let dateTime;
    let transactionCategory;
    let counterparty;
    let account;
    let description;
    let rawTransactionType;
    let rawAmount;
    let paymentMethod;
    let status;

    if (fields.length >= 12) {
      [dateTime, transactionCategory, counterparty, account, description, rawTransactionType, rawAmount, paymentMethod, status] = fields;
    } else if (fields.length >= 8) {
      [dateTime, transactionCategory, counterparty, description, rawTransactionType, rawAmount, paymentMethod, status] = fields;
      account = '';
    } else {
      continue;
    }

    const amount = parseAmount(rawAmount);
    if (amount === null) {
      continue;
    }

    const mappedCategory = findMappedCategory(categories, transactionCategory);
    transactions.push({
      id: index - dataStartIndex + 1,
      date: new Date(dateTime),
      type: rawTransactionType === '支出' ? 'expense' : 'income',
      internalTransactionType: rawTransactionType === '支出' ? 'Expense' : 'Income',
      amount: Math.abs(amount),
      description: description || 'Unknown Transaction',
      notes: counterparty ? `Counterparty: ${counterparty}` : '',
      counterparty: counterparty || '',
      counterpartName: counterparty || '',
      categoryId: mappedCategory?.id || null,
      categoryName: mappedCategory?.name || transactionCategory || '',
      paymentMethod: paymentMethod || 'Unknown',
      platform: 'alipay',
      transactionTime: dateTime || '',
      transactionCategory: transactionCategory || '',
      transactionType: rawTransactionType || '',
      amountRaw: rawAmount || '',
      source: paymentMethod || '',
      transactionStatus: status || '',
      originalData: {
        transactionCategory,
        counterparty,
        account,
        status,
      },
    });
  }

  return transactions;
}

export function parseWeChatCsv(text, categories) {
  const lines = String(text || '').split('\n');
  const dataStartIndex = findDataStartIndex(lines, ['交易时间', '收/支'], 15);
  const transactions = [];

  for (let index = dataStartIndex; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      continue;
    }

    const fields = parseCsvLine(line);
    if (fields.length < 6) {
      continue;
    }

    let dateTime;
    let transactionCategory;
    let counterparty;
    let description;
    let rawTransactionType;
    let rawAmount;
    let paymentMethod;
    let status;

    if (fields.length >= 11) {
      [dateTime, transactionCategory, counterparty, description, rawTransactionType, rawAmount, paymentMethod, status] = fields;
    } else if (fields.length >= 8) {
      [dateTime, transactionCategory, counterparty, description, rawTransactionType, rawAmount, paymentMethod, status] = fields;
    } else {
      continue;
    }

    const amount = parseAmount(rawAmount);
    if (amount === null) {
      continue;
    }

    const mappedCategory = findMappedCategory(categories, transactionCategory);
    transactions.push({
      id: index - dataStartIndex + 1,
      date: new Date(dateTime),
      type: rawTransactionType === '支出' ? 'expense' : 'income',
      internalTransactionType: rawTransactionType === '支出' ? 'Expense' : 'Income',
      amount: Math.abs(amount),
      description: description || 'Unknown Transaction',
      notes: counterparty ? `Counterparty: ${counterparty}` : '',
      counterparty: counterparty || '',
      counterpartName: counterparty || '',
      categoryId: mappedCategory?.id || null,
      categoryName: mappedCategory?.name || transactionCategory || '',
      paymentMethod: paymentMethod || 'Unknown',
      platform: 'wechat',
      transactionTime: dateTime || '',
      transactionCategory: transactionCategory || '',
      transactionType: rawTransactionType || '',
      amountRaw: rawAmount || '',
      source: paymentMethod || '',
      transactionStatus: status || '',
      originalData: {
        transactionCategory,
        counterparty,
        status,
      },
    });
  }

  return transactions;
}

export async function parseImportedFile({ file, platform, categories }) {
  if (platform === 'alipay') {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('gbk');
    return parseAlipayCsv(decoder.decode(buffer), categories);
  }

  if (platform === 'wechat') {
    return parseWeChatCsv(await file.text(), categories);
  }

  throw new Error(`Unsupported import platform: ${platform}`);
}
