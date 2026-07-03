import ky from 'ky';
import { API_PREFIX, TENANT_KEY, TOKEN_KEY } from '@/constants';
import { router } from '@/router';
import { message, notification } from '@/utils/antd-static';

function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
  window.location.href = `${router.basepath}/login`;
}

export const request = ky.create({
  prefix: API_PREFIX,
  timeout: 30000,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
        request.headers.set('X-App-Id', '501');
      },
    ],
    afterResponse: [
      async ({ response, request }) => {
        if (response.status === 401 || response.status === 403) {
          handleUnauthorized();
          return;
        }

        const silent = request.headers.get('X-Silent-Error') === 'true';

        const cloned = response.clone();

        if (!response.ok) {
          if (!silent) {
            try {
              const body = (await cloned.json()) as { message?: string };
              notification?.error({
                message: `请求失败 (${response.status})`,
                description: body?.message || response.statusText,
              });
            } catch {
              notification?.error({
                message: `请求失败 (${response.status})`,
                description: response.statusText,
              });
            }
          }
          return;
        }

        try {
          const body = (await cloned.json()) as { code: number; message?: string };
          if (body.code !== 0 && body.message && !silent) {
            message?.error(body.message);
          }
        } catch {
          // not JSON, skip
        }
      },
    ],
  },
});
