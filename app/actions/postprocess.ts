"use server"

import { Jimp } from "jimp"
import { uploadAssetBuffer } from "@/lib/firebase/storage"

export async function postProcessPixelArt(
  buffer: Uint8Array,
  options: {
    targetSize: number
    assetType: string
    identifier: string
  }
): Promise<string | null> {
  try {
    const image = await Jimp.fromBuffer(Buffer.from(buffer))

    image.resize({ w: options.targetSize, h: options.targetSize, mode: "nearestNeighbor" as never })

    const outputBuffer = Buffer.from(await image.getBuffer("image/png"))
    const path = `assets/${options.assetType}/px-${options.identifier}.png`
    return uploadAssetBuffer(new Uint8Array(outputBuffer), path, "image/png")
  } catch {
    return null
  }
}
