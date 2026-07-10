"use client";

import { useCallback } from "react";
import { playSound } from "@/lib/sound-engine";
import type { SoundAsset } from "@/lib/sound-types";

export function useSound(asset: SoundAsset, volume = 0.6) {
  const play = useCallback(() => {
    playSound(asset.dataUri, { volume }).catch(() => {});
  }, [asset.dataUri, volume]);

  return [play] as const;
}
