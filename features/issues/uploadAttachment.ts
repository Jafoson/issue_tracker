import {
  confirmIssueAttachmentUpload,
  requestIssueAttachmentUpload,
} from "@/features/issues/actions";
import type { IssueAttachment } from "@/types";

export type UploadAttachmentResult =
  | { ok: true; attachment: IssueAttachment }
  | { error: string };

/**
 * Lädt eine Datei direkt gegen S3 hoch (Browser → S3, nicht über den Server)
 * und bestätigt den Upload danach — derselbe zweistufige Ablauf wie bei
 * `AvatarUploader.tsx`, nur für Issue-Anhänge und ohne MIME-Einschränkung.
 * Verwendet sowohl vom Editor-Werkzeugleisten-Knopf/Drag&Drop/Einfügen als
 * auch vom „Anhang hinzufügen"-Knopf der Anhänge-Sektion.
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
    // Netzwerkfehler, CORS-Ablehnung durch den Bucket, o.ä. — `fetch` wirft
    // in diesen Fällen statt eine Antwort mit Fehlerstatus zu liefern.
    return { error: "Upload failed — please try again." };
  }
  if (!put.ok) return { error: "Upload failed — please try again." };

  return confirmIssueAttachmentUpload(issueId, requested.key, {
    fileName: file.name,
    contentType,
  });
}
