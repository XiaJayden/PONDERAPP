import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Trash2 } from "lucide-react-native";
import { useComments, type Comment } from "@/hooks/useComments";
import { useAuth } from "@/providers/auth-provider";

interface CommentSectionProps {
  postId: string;
}

function formatCommentTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CommentItem({
  comment,
  onDelete,
  canDelete,
}: {
  comment: Comment;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (isDeleting) return;

    if (Platform.OS === "ios") {
      Alert.alert("Delete comment", "Are you sure you want to delete this comment?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDelete();
            } catch (error) {
              console.warn("[CommentItem] delete failed", error);
              Alert.alert("Error", "Failed to delete comment");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]);
    } else {
      setIsDeleting(true);
      try {
        await onDelete();
      } catch (error) {
        console.warn("[CommentItem] delete failed", error);
        Alert.alert("Error", "Failed to delete comment");
      } finally {
        setIsDeleting(false);
      }
    }
  }

  return (
    <View className="mb-4 flex-row gap-3">
      <View className="h-8 w-8 overflow-hidden rounded-full bg-secondary">
        {comment.author_avatar_url ? (
          <Image source={{ uri: comment.author_avatar_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="font-mono text-[8px] text-muted-foreground">
              {comment.author_label?.slice(0, 2).toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-body text-sm font-semibold text-foreground">
            {comment.author_label ?? "User"}
          </Text>
          <Text className="font-mono text-[10px] text-muted-foreground">
            {formatCommentTime(comment.created_at)}
          </Text>
        </View>
        <Text style={{ fontFamily: "SpaceMono", fontSize: 14, lineHeight: 20 }} className="mt-1 text-foreground">
          {comment.content}
        </Text>
      </View>

      {canDelete && (
        <Pressable
          onPress={handleDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel="Delete comment"
          className="h-8 w-8 items-center justify-center"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="hsl(0 62% 50%)" />
          ) : (
            <Trash2 color="hsl(0 62% 50%)" size={16} />
          )}
        </Pressable>
      )}
    </View>
  );
}

export function CommentSection({ postId }: CommentSectionProps) {
  const { user } = useAuth();
  const { comments, isLoading, addComment, deleteComment, isAdding, canDelete } = useComments(postId);
  const [commentText, setCommentText] = useState("");

  async function handleSubmit() {
    if (!commentText.trim() || isAdding) return;

    const text = commentText.trim();
    setCommentText("");

    try {
      await addComment(text);
    } catch (error) {
      console.warn("[CommentSection] addComment failed", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to add comment");
      setCommentText(text); // Restore text on error
    }
  }

  return (
    <View>
      {/* Comments List */}
      {isLoading ? (
        <View className="py-8 items-center">
          <ActivityIndicator />
          <Text className="mt-2 font-mono text-xs text-muted-foreground">Loading comments…</Text>
        </View>
      ) : comments.length === 0 ? (
        <View className="py-8 items-center">
          <Text className="font-mono text-sm text-muted-foreground">No comments yet</Text>
          <Text className="mt-1 font-mono text-[10px] text-muted-foreground">Be the first to comment</Text>
        </View>
      ) : (
        <View>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onDelete={() => deleteComment(comment.id)}
              canDelete={canDelete(comment)}
            />
          ))}
        </View>
      )}

      {/* Comment Input */}
      {user ? (
        <View className="mt-6 border-t border-muted bg-card px-4 py-3">
          <View className="flex-row items-end gap-3">
            <View className="flex-1 rounded-xl border border-muted bg-background px-4 py-3">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment..."
                placeholderTextColor="hsl(0 0% 55%)"
                multiline
                maxLength={500}
                style={{
                  fontFamily: "SpaceMono",
                  fontSize: 14,
                  lineHeight: 20,
                  color: "hsl(60 9% 98%)",
                  minHeight: 40,
                  maxHeight: 100,
                }}
                editable={!isAdding}
              />
            </View>
            <Pressable
              onPress={handleSubmit}
              disabled={!commentText.trim() || isAdding}
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              className={[
                "rounded-xl px-4 py-3",
                commentText.trim() && !isAdding ? "bg-primary" : "bg-muted",
              ].join(" ")}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="hsl(0 0% 4%)" />
              ) : (
                <Text
                  className={[
                    "font-mono text-xs uppercase tracking-wider",
                    commentText.trim() && !isAdding ? "text-background" : "text-muted-foreground",
                  ].join(" ")}
                >
                  Post
                </Text>
              )}
            </Pressable>
          </View>
          {commentText.length > 0 && (
            <Text className="mt-2 text-right font-mono text-[10px] text-muted-foreground">
              {commentText.length}/500
            </Text>
          )}
        </View>
      ) : (
        <View className="mt-6 border-t border-muted bg-card px-4 py-3">
          <Text className="text-center font-mono text-xs text-muted-foreground">
            Sign in to comment
          </Text>
        </View>
      )}
    </View>
  );
}
