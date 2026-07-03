import { notification } from '@/utils/antd-static';

export function showPersistentNotification(
  type: 'success' | 'error' | 'info' | 'warning',
  message: string,
  description?: string,
  key?: string,
): void {
  const notificationKey = key || `${type}-${Date.now()}`;

  notification[type]({
    message,
    description,
    key: notificationKey,
    duration: 0,
    placement: 'topRight',
  });
}

export function closeNotification(key: string): void {
  notification.destroy(key);
}

export function closeAllNotifications(): void {
  notification.destroy();
}
