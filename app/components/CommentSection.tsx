'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Image from 'next/image';

interface Comment {
  id: string;
  user_id: string;
  spot_id: string;
  content: string;
  created_at: string;
  image_url?: string;
  likes?: number;
  user_profile?: {
    username: string;
  };
}

interface CommentSectionProps {
  spotId: string;
  currentUserId: string | null;
}

export default function CommentSection({ spotId, currentUserId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchComments();
    if (currentUserId) {
      fetchUserLikes();
    }
    
    // Set up real-time subscription
    const channel = supabase
      .channel('comments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `spot_id=eq.${spotId}`
        },
        () => {
          fetchComments();
          if (currentUserId) {
            fetchUserLikes();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spotId, currentUserId]);

  const fetchUserLikes = async () => {
    const { data, error } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', currentUserId);

    if (!error && data) {
      const likes: Record<string, boolean> = {};
      data.forEach(like => {
        likes[like.comment_id] = true;
      });
      setUserLikes(likes);
    }
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        user_profile:profiles(username),
        likes:comment_likes(count)
      `)
      .eq('spot_id', spotId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching comments:', error);
    } else {
      const commentsWithLikes = data?.map(comment => ({
        ...comment,
        likes: comment.likes?.[0]?.count || 0
      })) || [];
      setComments(commentsWithLikes);
    }
  };

  const uploadImage = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `comments/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('item-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('item-images')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      alert('Please log in to comment');
      return;
    }
    if (!newComment.trim() && !imageFile) return;

    setIsLoading(true);
    try {
      let imageUrl;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase
        .from('comments')
        .insert([
          {
            spot_id: spotId,
            user_id: currentUserId,
            content: newComment.trim(),
            image_url: imageUrl,
            likes: 0
          }
        ]);

      if (error) throw error;

      setNewComment('');
      setImageFile(null);
      await fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (commentId: string, newContent: string) => {
    if (!newContent.trim()) return;

    try {
      let imageUrl;
      if (editImageFile) {
        imageUrl = await uploadImage(editImageFile);
      }

      const { error } = await supabase
        .from('comments')
        .update({ 
          content: newContent.trim(),
          image_url: imageUrl || (editImageFile === null ? null : undefined)
        })
        .eq('id', commentId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      setEditingComment(null);
      setEditContent('');
      setEditImageFile(null);
      await fetchComments();
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Failed to update comment');
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      await fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  };

  const handleLike = async (commentId: string) => {
    if (!currentUserId) {
      alert('Please log in to like comments');
      return;
    }

    try {
      if (userLikes[commentId]) {
        // Unlike
        const { error: unlikeError } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId);

        if (unlikeError) throw unlikeError;

        setUserLikes(prev => {
          const newLikes = { ...prev };
          delete newLikes[commentId];
          return newLikes;
        });
      } else {
        // Like
        const { error: likeError } = await supabase
          .from('comment_likes')
          .insert([{ comment_id: commentId, user_id: currentUserId }]);

        if (likeError) throw likeError;

        setUserLikes(prev => ({ ...prev, [commentId]: true }));
      }

      // Fetch updated comments to get new likes count
      await fetchComments();
    } catch (error) {
      console.error('Error toggling like:', error);
      alert('Failed to update like');
    }
  };

  return (
    <div className="mt-6">
      <h2 className="font-cornerstone text-xl mb-4">COMMENTS</h2>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            disabled={!currentUserId || isLoading}
            className="w-full p-3 border rounded resize-none focus:outline-none bg-white/80"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!currentUserId || isLoading || (!newComment.trim() && !imageFile)}
              className="bg-blue-500 text-white px-6 py-2 rounded font-semibold disabled:opacity-50 hover:bg-blue-600"
            >
              POST COMMENT
            </button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              <div className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
            </label>
          </div>
          {imageFile && (
            <div className="text-sm text-gray-600">
              Selected: {imageFile.name}
              <button
                type="button"
                onClick={() => setImageFile(null)}
                className="ml-2 text-red-500"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </form>

      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="border-b pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                👤
              </div>
              <span className="font-semibold">{comment.user_profile?.username || 'Anonymous'}</span>
              <span className="text-sm text-gray-500">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            
            {editingComment === comment.id ? (
              <div className="mt-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2 border rounded mb-2"
                  rows={2}
                />
                
                <div className="mb-2">
                  {comment.image_url && !editImageFile && (
                    <div className="relative">
                      <Image
                        src={comment.image_url}
                        alt="Current image"
                        width={200}
                        height={150}
                        className="rounded object-cover"
                      />
                      <button
                        onClick={() => setEditImageFile(null)}
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                        title="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  
                  {editImageFile && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">New image selected: {editImageFile.name}</p>
                      <button
                        onClick={() => setEditImageFile(null)}
                        className="text-red-500 text-sm ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <label className="cursor-pointer inline-block mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setEditImageFile(e.target.files?.[0] || null)}
                    />
                    <div className="flex items-center gap-1 text-blue-500 hover:text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span className="text-sm">Change image</span>
                    </div>
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(comment.id, editContent)}
                    className="text-blue-500 text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingComment(null);
                      setEditContent('');
                      setEditImageFile(null);
                    }}
                    className="text-gray-500 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-2">{comment.content}</p>
                {comment.image_url && (
                  <div className="mt-2 mb-2">
                    <Image
                      src={comment.image_url}
                      alt="Comment image"
                      width={300}
                      height={200}
                      className="rounded object-cover"
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => handleLike(comment.id)}
                className={`flex items-center gap-1 ${userLikes[comment.id] ? 'text-red-500' : 'text-gray-500'} hover:text-red-500`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={userLikes[comment.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>{comment.likes}</span>
              </button>
              
              {currentUserId === comment.user_id && (
                <>
                  <button
                    onClick={() => {
                      setEditingComment(comment.id);
                      setEditContent(comment.content);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-center text-gray-500">No comments yet</p>
        )}
      </div>
    </div>
  );
} 