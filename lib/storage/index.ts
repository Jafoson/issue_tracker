import "server-only";

export type {
  AvatarKind,
  RequestAvatarUploadResult,
} from "@/lib/storage/avatars";
export {
  deleteAvatarObject,
  finalizeAvatarUpload,
  requestAvatarUpload,
  resolveAvatarUrl,
} from "@/lib/storage/avatars";
export type { StorageConfig } from "@/lib/storage/config";
export { isStorageConfigured, storageConfig } from "@/lib/storage/config";
export {
  deleteObjectSafely,
  objectExists,
  presignGetUrl,
  presignPutUrl,
} from "@/lib/storage/presign";
