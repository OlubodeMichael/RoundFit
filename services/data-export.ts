import { Directory, File, Paths } from 'expo-file-system';
import { getLocalDateString } from '@/utils/date';
import { apiFetch } from '@/utils/api';
import {
  DataExportError,
  type UserDataExport,
} from '@/types/data-export';

function parseExportPayload(body: Record<string, unknown>): UserDataExport {
  const data = (body.data ?? body) as Record<string, unknown>;
  if (typeof data.export_version !== 'string' || typeof data.generated_at !== 'string') {
    throw new DataExportError('invalid_response', 'Export file was incomplete. Please try again.');
  }
  return data as unknown as UserDataExport;
}

function mapApiError(status: number, body: Record<string, unknown>): DataExportError {
  const err = typeof body.error === 'string' ? body.error : '';
  if (status === 401) {
    return new DataExportError('unauthorized', 'Please sign in again and retry.');
  }
  if (status === 429 || err === 'export_rate_limited') {
    return new DataExportError('rate_limited', 'You can export your data once per day. Try again tomorrow.');
  }
  if (status === 409 || err === 'account_deleting') {
    return new DataExportError('account_deleting', 'Export is unavailable while your account is being deleted.');
  }
  return new DataExportError('server', 'Could not export your data. Please try again.');
}

/** Fetches the full user export from POST /auth/export. */
export async function fetchUserDataExport(): Promise<UserDataExport> {
  let result: { ok: boolean; status: number; body: Record<string, unknown> };
  try {
    result = await apiFetch('/auth/export', { method: 'POST' });
  } catch {
    throw new DataExportError('network', 'Connect to the internet and try again.');
  }

  if (!result.ok) {
    throw mapApiError(result.status, result.body);
  }

  return parseExportPayload(result.body);
}

/** Writes export JSON to cache and returns a shareable file URI. */
export async function writeExportToCacheFile(exportData: UserDataExport): Promise<string> {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

  const stamp = getLocalDateString(new Date(exportData.generated_at));
  const file = new File(dir, `roundfit-export-${stamp}.json`);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(JSON.stringify(exportData, null, 2));
  return file.uri;
}
