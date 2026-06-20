import { toast } from 'sonner';

let lastToastId: string | number | null = null;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (lastToastId !== null) {
    toast.dismiss(lastToastId);
  }
  lastToastId = toast[type](message, {
    duration: 4000,
    position: 'bottom-center',
  });
}
