export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  name: string;
}

export interface DriveBackupResult {
  fileId: string;
  webViewLink: string;
  name: string;
  overwritten: boolean;
  savedAt: string;
}

export const BACKUP_DRIVE_FILENAME = 'backup_buku_kas_rt05.json';

/**
 * Saves or updates a JSON backup file in Google Drive.
 * If a file with the given name already exists, it is overwritten in place
 * without creating endless new revisions or duplicate versions.
 */
export const saveBackupJsonToDrive = async (
  accessToken: string,
  backupData: unknown,
  fileName: string = BACKUP_DRIVE_FILENAME
): Promise<DriveBackupResult> => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const jsonContent = JSON.stringify(backupData, null, 2);

  // 1. Search for existing file with exact fileName (not trashed)
  const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
  let existingFileId: string | null = null;
  let webViewLink = '';

  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
      { headers }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
        webViewLink =
          searchData.files[0].webViewLink ||
          `https://drive.google.com/file/d/${existingFileId}/view`;
      }
    }
  } catch (err) {
    console.warn('Drive file search notice:', err);
  }

  // 2. If file already exists, OVERWRITE it using PATCH (uploadType=media)
  // keepRevisionForever=false ensures no permanent extra revisions are accumulated
  if (existingFileId) {
    const patchRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media&keepRevisionForever=false`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: jsonContent,
      }
    );

    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Gagal memperbarui file cadangan di Google Drive.');
    }

    const updatedData = await patchRes.json().catch(() => ({ id: existingFileId }));
    return {
      fileId: updatedData.id || existingFileId,
      webViewLink: webViewLink || `https://drive.google.com/file/d/${existingFileId}/view`,
      name: fileName,
      overwritten: true,
      savedAt: new Date().toISOString(),
    };
  }

  // 3. If file does not exist yet, create it using multipart upload
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: 'Cadangan data otomatis Buku Kas & Iuran Warga RT 05 / RW 08 Satriajaya',
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  const createRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gagal membuat file cadangan baru di Google Drive.');
  }

  const createdData = await createRes.json();
  return {
    fileId: createdData.id,
    webViewLink: createdData.webViewLink || `https://drive.google.com/file/d/${createdData.id}/view`,
    name: createdData.name || fileName,
    overwritten: false,
    savedAt: new Date().toISOString(),
  };
};

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
