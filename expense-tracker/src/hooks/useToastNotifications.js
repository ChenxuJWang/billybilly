import { useEffect } from 'react';
import { toast } from 'sonner';

export function useToastNotifications({
  success,
  error,
  onSuccessShown,
  onErrorShown,
}) {
  useEffect(() => {
    if (!success) {
      return;
    }

    toast.success(success);
    onSuccessShown?.('');
  }, [onSuccessShown, success]);

  useEffect(() => {
    if (!error) {
      return;
    }

    toast.error(error);
    onErrorShown?.('');
  }, [error, onErrorShown]);
}
