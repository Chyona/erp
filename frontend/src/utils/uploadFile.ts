type UploadFileLike = {
  name?: string;
  originFileObj?: File;
};

export function resolveUploadFile(file: unknown): File {
  if (file instanceof File) return file;
  const item = file as UploadFileLike;
  if (item?.originFileObj instanceof File) return item.originFileObj;
  throw new Error('无效的上传文件');
}

export function resolveUploadFileName(file: unknown, fallback = 'attachment'): string {
  if (file instanceof File && file.name) return file.name;
  const item = file as UploadFileLike;
  return String(item?.name || item?.originFileObj?.name || fallback);
}
