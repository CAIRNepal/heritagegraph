'use client';

import React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ArrowUp,
  ArrowDown,
  MessageSquare,
  // ChevronRight,
  // ChevronDown,
  ChevronLeft,
} from 'lucide-react';

interface Comment {
  id: number;
  author: string;
  content: string;
  timestamp: string;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  replies?: Comment[];
  isModerator?: boolean;
  isTopPoster?: boolean;
}

interface CommentSectionProps {
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
}

export default function CommentSection({ comments, setComments }: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [focusedComment, setFocusedComment] = useState<Comment | null>(null);

  const addComment = () => {
    if (!newComment.trim()) return;
    const comment: Comment = {
      id: Date.now(),
      author: 'You',
      content: newComment,
      timestamp: 'just now',
      upvotes: 0,
      downvotes: 0,
      userVote: null,
    };
    setComments([...comments, comment]);
    setNewComment('');
  };

  const vote = (id: number, direction: 'up' | 'down') => {
    const updateVotes = (comments: Comment[]): Comment[] =>
      comments.map((comment) => {
        if (comment.id === id) {
          if (comment.userVote === direction) {
            return {
              ...comment,
              upvotes: direction === 'up' ? comment.upvotes - 1 : comment.upvotes,
              downvotes:
                direction === 'down' ? comment.downvotes - 1 : comment.downvotes,
              userVote: null,
            };
          } else if (comment.userVote) {
            return {
              ...comment,
              upvotes: direction === 'up' ? comment.upvotes + 1 : comment.upvotes - 1,
              downvotes:
                direction === 'down' ? comment.downvotes + 1 : comment.downvotes - 1,
              userVote: direction,
            };
          } else {
            return {
              ...comment,
              upvotes: direction === 'up' ? comment.upvotes + 1 : comment.upvotes,
              downvotes:
                direction === 'down' ? comment.downvotes + 1 : comment.downvotes,
              userVote: direction,
            };
          }
        }
        if (comment.replies)
          return { ...comment, replies: updateVotes(comment.replies) };
        return comment;
      });
    setComments(updateVotes(comments));
  };

  const addReply = (parentId: number, replyText: string) => {
    if (!replyText.trim()) return;
    const recursiveAdd = (items: Comment[]): Comment[] =>
      items.map((c) =>
        c.id === parentId
          ? {
              ...c,
              replies: [
                ...(c.replies || []),
                {
                  id: Date.now(),
                  author: 'You',
                  content: replyText,
                  timestamp: 'just now',
                  upvotes: 0,
                  downvotes: 0,
                  userVote: null,
                },
              ],
            }
          : { ...c, replies: recursiveAdd(c.replies || []) },
      );
    setComments(recursiveAdd(comments));
  };

  const displayedComments = focusedComment ? [focusedComment] : comments;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-2">
        {focusedComment && (
          <button
            className="flex items-center space-x-1 text-gray-500"
            onClick={() => setFocusedComment(null)}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
        )}
        <h2 className="text-xl font-semibold">
          {focusedComment ? 'Replies' : 'Comments'}
        </h2>
        {!focusedComment && (
          <span className="text-sm text-gray-500">• Sorted by: Top</span>
        )}
      </div>

      {/* Input */}
      {!focusedComment && (
        <div className="flex space-x-2">
          <Input
            placeholder="What are your thoughts?"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1"
          />
          <Button onClick={addComment}>Comment</Button>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4 mt-4">
        <AnimatePresence>
          {displayedComments.map((comment) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
            >
              <CommentThread
                comment={comment}
                vote={vote}
                addReply={addReply}
                level={0}
                onFocus={(c) => setFocusedComment(c)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CommentThread({
  comment,
  vote,
  addReply,
  level,
  onFocus,
}: {
  comment: Comment;
  vote: (id: number, direction: 'up' | 'down') => void;
  addReply: (parentId: number, replyText: string) => void;
  level: number;
  onFocus: (c: Comment) => void;
}) {
  const [reply, setReply] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReplies] = useState(false);

  return (
    <div className={`${level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}`}>
      {/* Vote + Content */}
      <div className="flex space-x-2">
        <div className="flex flex-col items-center w-10 shrink-0">
          <button
            onClick={() => vote(comment.id, 'up')}
            className={`p-1 rounded ${comment.userVote === 'up' ? 'text-green-600 bg-green-100' : 'text-gray-400 hover:text-green-600'}`}
          >
            <ArrowUp size={18} />
          </button>
          <span className="text-sm font-semibold my-1">{comment.upvotes}</span>
          <button
            onClick={() => vote(comment.id, 'down')}
            className={`p-1 rounded ${comment.userVote === 'down' ? 'text-red-600 bg-red-100' : 'text-gray-400 hover:text-red-600'}`}
          >
            <ArrowDown size={18} />
          </button>
          <span className="text-sm font-semibold my-1">{comment.downvotes}</span>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <span
              className={`font-medium ${comment.isModerator ? 'text-green-600' : ''}`}
            >
              {comment.author}
            </span>
            {comment.isModerator && (
              <span className="px-1 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                MOD
              </span>
            )}
            {comment.isTopPoster && (
              <span className="px-1 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">
                Top 1% Poster
              </span>
            )}
            <span>•</span>
            <span>{comment.timestamp}</span>
          </div>

          <p className="mt-1 text-sm">{comment.content}</p>

          {/* Actions */}
          <div className="flex space-x-4 mt-1 text-xs text-gray-500">
            <button
              className="flex items-center space-x-1 hover:bg-gray-100 px-1 py-0.5 rounded"
              onClick={() => setShowReplyBox(!showReplyBox)}
            >
              <MessageSquare size={14} />
              <span>Reply</span>
            </button>
            {comment.replies && comment.replies.length > 0 && (
              <button
                className="flex items-center space-x-1 hover:bg-gray-100 px-1 py-0.5 rounded"
                onClick={() => onFocus(comment)}
              >
                <span>Show Replies ({comment.replies.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply Box */}
      {showReplyBox && (
        <div className="mt-2 flex space-x-2">
          <Input
            placeholder="Write a reply..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="flex-1 text-sm h-8"
          />
          <Button
            size="sm"
            onClick={() => {
              addReply(comment.id, reply);
              setReply('');
              setShowReplyBox(false);
            }}
          >
            Reply
          </Button>
        </div>
      )}

      {/* Nested Replies (only in focus) */}
      {comment.replies && comment.replies.length > 0 && showReplies && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              vote={vote}
              addReply={addReply}
              level={level + 1}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
