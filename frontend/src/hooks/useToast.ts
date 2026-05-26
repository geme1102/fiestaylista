import { toast } from 'sonner';

export { toast };

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  toast[type](message, {
    duration: 4000,
    position: 'bottom-center',
  });
}
