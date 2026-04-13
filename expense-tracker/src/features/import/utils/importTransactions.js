import { collection, doc, getDocs, query, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase';
import { IGNORE_CATEGORY_NAME } from '@/features/categorization/ruleEngine';

function getDuplicateKey(transaction) {
  return `${transaction.date.toISOString()}-${transaction.amount}-${transaction.description}`;
}

export async function importTransactionsToLedger({
  currentLedger,
  currentUser,
  canEdit,
  transactions,
  onProgress,
}) {
  if (!currentLedger || !currentUser || !canEdit()) {
    throw new Error('You do not have permission to import transactions');
  }

  const transactionsRef = collection(db, 'ledgers', currentLedger.id, 'transactions');
  const existingSnapshot = await getDocs(query(transactionsRef));
  const existingTransactions = new Set();

  existingSnapshot.forEach((snapshot) => {
    const transaction = snapshot.data();
    const duplicateDate = transaction.date?.toDate?.();
    if (!duplicateDate) {
      return;
    }

    existingTransactions.add(
      `${duplicateDate.toISOString()}-${transaction.amount}-${transaction.description}`
    );
  });

  const batchSize = 500;
  const pendingBatches = [];
  let imported = 0;
  let skipped = 0;
  let ignored = 0;

  for (let index = 0; index < transactions.length; index += batchSize) {
    const batch = writeBatch(db);
    const chunk = transactions.slice(index, index + batchSize);
    let chunkImported = 0;
    let chunkSkipped = 0;

    for (const transaction of chunk) {
      if (transaction.categoryName === IGNORE_CATEGORY_NAME) {
        ignored += 1;
        continue;
      }

      const duplicateKey = getDuplicateKey(transaction);
      if (existingTransactions.has(duplicateKey)) {
        chunkSkipped += 1;
        continue;
      }

      const transactionRef = doc(transactionsRef);
      batch.set(transactionRef, {
        date: Timestamp.fromDate(transaction.date),
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        notes: transaction.notes || '',
        categoryId: transaction.categoryId,
        categoryName: transaction.categoryName || '',
        paymentMethod: transaction.paymentMethod || 'Unknown',
        includeInBudget: true,
        platform: transaction.platform,
        originalData: transaction.originalData || {},
        pinned: false,
        createdAt: Timestamp.now(),
        createdBy: currentUser.uid,
        paidBy: currentUser.uid,
      });

      existingTransactions.add(duplicateKey);
      chunkImported += 1;
    }

    if (chunkImported > 0) {
      pendingBatches.push({
        batch,
        imported: chunkImported,
        skipped: chunkSkipped,
      });
    } else {
      skipped += chunkSkipped;
    }
  }

  for (let index = 0; index < pendingBatches.length; index += 1) {
    await pendingBatches[index].batch.commit();
    imported += pendingBatches[index].imported;
    skipped += pendingBatches[index].skipped;

    if (onProgress) {
      onProgress(Math.round(((index + 1) / pendingBatches.length) * 100));
    }
  }

  return { imported, skipped, ignored };
}
