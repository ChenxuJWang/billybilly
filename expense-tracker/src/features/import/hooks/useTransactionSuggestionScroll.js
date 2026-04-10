import { createRef, useEffect, useRef } from 'react';

export function useTransactionSuggestionScroll(displayedTransactions, isProcessing) {
  const transactionRefs = useRef({});
  const previousSuggestions = useRef({});

  useEffect(() => {
    if (!isProcessing) {
      return;
    }

    let lastChangedTransactionId = null;

    displayedTransactions.forEach((transaction) => {
      if (
        transaction.suggestedCategory &&
        previousSuggestions.current[transaction.id] !== transaction.suggestedCategory
      ) {
        lastChangedTransactionId = transaction.id;
      }
    });

    previousSuggestions.current = Object.fromEntries(
      displayedTransactions.map((transaction) => [transaction.id, transaction.suggestedCategory])
    );

    if (lastChangedTransactionId && transactionRefs.current[lastChangedTransactionId]) {
      transactionRefs.current[lastChangedTransactionId].current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [displayedTransactions, isProcessing]);

  const getTransactionRef = (transactionId) => {
    if (!transactionRefs.current[transactionId]) {
      transactionRefs.current[transactionId] = createRef();
    }

    return transactionRefs.current[transactionId];
  };

  return { getTransactionRef };
}
