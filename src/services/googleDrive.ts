export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  name: string;
}

export const uploadFileToGoogleDrive = async (
  accessToken: string,
  file: File,
  customFileName?: string
): Promise<DriveUploadResult> => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  // 1. Search if folder "Bukti Kas & Iuran RT" already exists
  const folderName = 'Bukti Kas & Iuran RT';
  let folderId = '';

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    )}`,
    { headers }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id;
    }
  }

  // If folder doesn't exist, create it
  if (!folderId) {
    const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createFolderRes.ok) {
      const folderData = await createFolderRes.json();
      folderId = folderData.id;
    }
  }

  // 2. Upload file using multipart upload
  const resolvedFileName = customFileName || file.name;
  const metadata = {
    name: resolvedFileName,
    parents: folderId ? [folderId] : undefined,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers,
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(err.error?.message || 'Gagal mengunggah file ke Google Drive.');
  }

  const fileData = await uploadRes.json();
  return {
    fileId: fileData.id,
    webViewLink: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`,
    name: fileData.name || resolvedFileName,
  };
};
