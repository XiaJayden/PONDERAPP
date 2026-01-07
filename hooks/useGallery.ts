import { useCallback, useEffect, useMemo, useState } from "react";

import type { Post } from "@/components/posts/yim-post";
import { useUserPosts } from "@/hooks/useYimFeed";

/**
 * Gallery hook.
 *
 * Web gallery is a swipe carousel of the user's posts. For native:
 * - We reuse `useUserPosts()` and present a carousel UI on top of it.
 * - Later we can add date-based filtering/calendar view.
 */

export function useGallery() {
  const userPosts = useUserPosts();

  const posts = useMemo(() => userPosts.posts, [userPosts.posts]);

  // Keep a stable shape similar to the web hook.
  return {
    posts,
    isLoading: userPosts.isLoading,
    errorMessage: userPosts.errorMessage,
    refetch: userPosts.refetch,
  };
}




