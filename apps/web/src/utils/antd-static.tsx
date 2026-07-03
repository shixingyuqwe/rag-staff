import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import type { NotificationInstance } from 'antd/es/notification/interface';

let message: MessageInstance;
let notification: NotificationInstance;
let modal: Omit<ModalStaticFunctions, 'warn'>;

export function AntdStaticHolder() {
  const app = App.useApp();
  message = app.message;
  notification = app.notification;
  modal = app.modal;
  return null;
}

export { message, modal, notification };
