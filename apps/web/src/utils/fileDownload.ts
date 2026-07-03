import { message as antdMessage } from 'antd';
import ky from 'ky';
import { MF_API_BASE, MF_API_TOKEN } from '@/constants';

export async function downloadTemplate(url: string, fileName?: string): Promise<void> {
  try {
    antdMessage.loading({ content: '正在获取模板...', key: 'download-template' });

    const response = await ky
      .get(url)
      .json<{ code: number; success: boolean; data: string; message: string }>();

    if (response.code !== 0 || !response.success) {
      throw new Error(response.message || '获取模板下载地址失败');
    }

    if (!response.data) {
      throw new Error('下载地址为空');
    }

    const blob = await ky.get(response.data).blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;

    const mimeToExt: Record<string, string> = {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-excel': '.xls',
      'text/csv': '.csv',
      'application/pdf': '.pdf',
    };
    const ext = mimeToExt[blob.type] || '';
    const resolvedName = fileName
      ? (fileName.includes('.') ? fileName : `${fileName}${ext}`)
      : '';
    anchor.download = resolvedName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(blobUrl);

    antdMessage.success({ content: '模板下载成功', key: 'download-template' });
  } catch (error) {
    console.error('模板下载失败:', error);
    antdMessage.error({
      content: error instanceof Error ? error.message : '模板下载失败',
      key: 'download-template',
    });
  }
}

export async function downloadFileFromMF(fileSn: string, fileName: string): Promise<void> {
  try {
    antdMessage.loading({ content: '正在下载文件...', key: 'download' });

    const response = await ky
      .get(`${MF_API_BASE}/open/v1/file/down/${fileSn}`, {
        headers: {
          'X-API-TOKEN': MF_API_TOKEN,
        },
      })
      .json<{ code: number; success: boolean; data: { fileUrl: string }; message: string }>();

    if (response.code !== 0 || !response.success) {
      throw new Error(response.message || '获取下载地址失败');
    }

    const blob = await ky.get(response.data.fileUrl).blob();

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);

    antdMessage.success({ content: '文件下载成功！', key: 'download' });
  } catch (error) {
    console.error('文件下载失败:', error);
    antdMessage.error({
      content: error instanceof Error ? error.message : '文件下载失败',
      key: 'download',
    });
  }
}
