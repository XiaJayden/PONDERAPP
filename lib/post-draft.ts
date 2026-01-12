import * as SecureStore from "expo-secure-store";

import type { BackgroundType, FontColor, FontStyle } from "@/components/posts/yim-post";

export type PostDraftV1 = {
  v: 1;
  updatedAt: string; // ISO
  step: "content" | "style";
  quote: string;
  expandedText: string;
  background: BackgroundType;
  font: FontStyle;
  fontColor: FontColor;
  photoUri: string | null;
  promptId?: string;
  promptDate?: string;
};

function getDraftKey(params: { userId: string; promptId?: string }) {
  const promptKey = params.promptId ? `prompt_${params.promptId}` : "general";
  return `post_draft_${params.userId}_${promptKey}`;
}

export async function getPostDraft(params: { userId: string; promptId?: string }) {
  const key = getDraftKey(params);
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostDraftV1;
    if (!parsed || parsed.v !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn("[post-draft] getPostDraft failed", { key, error });
    return null;
  }
}

export async function setPostDraft(params: { userId: string; promptId?: string; draft: Omit<PostDraftV1, "v" | "updatedAt"> }) {
  const key = getDraftKey(params);
  try {
    const payload: PostDraftV1 = {
      v: 1,
      updatedAt: new Date().toISOString(),
      ...params.draft,
    };
    await SecureStore.setItemAsync(key, JSON.stringify(payload), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch (error) {
    console.warn("[post-draft] setPostDraft failed", { key, error });
  }
}

export async function deletePostDraft(params: { userId: string; promptId?: string }) {
  const key = getDraftKey(params);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn("[post-draft] deletePostDraft failed", { key, error });
  }
}




