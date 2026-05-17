"use server"

import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { getFirebaseStorage } from "./client"

export async function uploadAssetBuffer(
  buffer: ArrayBuffer,
  path: string,
  contentType: string
): Promise<string> {
  const storage = getFirebaseStorage()
  const storageRef = ref(storage, path)
  const result = await uploadBytes(storageRef, buffer, { contentType })
  const downloadUrl = await getDownloadURL(result.ref)
  return downloadUrl
}
