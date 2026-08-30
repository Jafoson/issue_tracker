import {
  confirmIssueAttachmentUpload,
  requestIssueAttachmentUpload,
} from "@/features/issues/actions";
import type { IssueAttachment } from "@/types";

export type UploadAttachmentResult =
  | { ok: true; attachment: IssueAttachment }
  | { error: string };

/**
 * Uploads a file directly to S3 (browser → S3, not through the server) and
 * confirms the upload afterward — the same two-step flow as
 * `AvatarUploader.tsx`, just for issue attachments and without a MIME
 * restriction. Used both by the editor's toolbar button/drag-and-drop/paste
 * and by the "add attachment" button in the attachments section.
 */
export async function uploadIssueAttachment(
  issueId: string,
  file: File,
): Promise<UploadAttachmentResult> {
  const contentType = file.type || "application/octet-stream";

  const requested = await requestIssueAttachmentUpload(issueId, {
    fileName: file.name,
    contentType,
    contentLength: file.size,
  });
  if ("error" in requested) return requested;

  let put: Response;
  try {
    put = await fetch(requested.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
  } catch {
    // Network error, CORS rejection from the bucket, etc. — `fetch` throws
    // in these cases instead of returning a response with an error status.
    return { error: "Upload failed — please try again." };
  }
  if (!put.ok) return { error: "Upload failed — please try again." };

  return confirmIssueAttachmentUpload(issueId, requested.key, {
    fileName: file.name,
    contentType,
  });
}
