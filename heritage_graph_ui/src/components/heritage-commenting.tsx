'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, MessageSquare, Share, MoreHorizontal } from 'lucide-react';

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
          // User is changing their vote
          if (comment.userVote === direction) {
            return {
              ...comment,
              upvotes: direction === 'up' ? comment.upvotes - 1 : comment.upvotes,
              downvotes:
                direction === 'down' ? comment.downvotes - 1 : comment.downvotes,
              userVote: null,
            };
          }
          // User is voting opposite of previous vote
          else if (comment.userVote) {
            return {
              ...comment,
              upvotes: direction === 'up' ? comment.upvotes + 1 : comment.upvotes - 1,
              downvotes:
                direction === 'down' ? comment.downvotes + 1 : comment.downvotes - 1,
              userVote: direction,
            };
          }
          // User is voting for the first time
          else {
            return {
              ...comment,
              upvotes: direction === 'up' ? comment.upvotes + 1 : comment.upvotes,
              downvotes:
                direction === 'down' ? comment.downvotes + 1 : comment.downvotes,
              userVote: direction,
            };
          }
        }
        if (comment.replies) {
          return { ...comment, replies: updateVotes(comment.replies) };
        }
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <h2 className="text-xl font-semibold">Comments</h2>
        <span className="text-sm text-gray-500">• Sorted by: Top</span>
      </div>

      {/* Input */}
      <div className="flex space-x-2">
        <Input
          placeholder="What are your thoughts?"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="flex-1"
        />
        <Button onClick={addComment}>Comment</Button>
      </div>

      {/* List */}
      <div className="space-y-4 mt-4">
        <AnimatePresence>
          {comments.map((comment) => (
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
}: {
  comment: Comment;
  vote: (id: number, direction: 'up' | 'down') => void;
  addReply: (parentId: number, replyText: string) => void;
  level: number;
}) {
  const [reply, setReply] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`flex ${level > 0 ? 'ml-6 pl-2 border-l-2 border-gray-100' : ''}`}>
      {/* Vote buttons */}
      <div className="flex flex-col items-center mr-2 w-8">
        <button
          onClick={() => vote(comment.id, 'up')}
          className={`${comment.userVote === 'up' ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'}`}
        >
          <ArrowUp size={16} />
        </button>
        <span className="text-xs font-medium my-1">
          {comment.upvotes - comment.downvotes}
        </span>
        <button
          onClick={() => vote(comment.id, 'down')}
          className={`${comment.userVote === 'down' ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'}`}
        >
          <ArrowDown size={16} />
        </button>
      </div>

      {/* Comment content */}
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

        {!collapsed && (
          <>
            <p className="mt-1 text-sm">{comment.content}</p>
            <div className="flex space-x-4 mt-1 text-xs text-gray-500">
              <button
                className="flex items-center space-x-1 hover:bg-gray-100 px-1 py-0.5 rounded"
                onClick={() => setShowReplyBox(!showReplyBox)}
              >
                <MessageSquare size={14} />
                <span>Reply</span>
              </button>
              <button className="flex items-center space-x-1 hover:bg-gray-100 px-1 py-0.5 rounded">
                <Share size={14} />
                <span>Share</span>
              </button>
              <button className="flex items-center space-x-1 hover:bg-gray-100 px-1 py-0.5 rounded">
                <MoreHorizontal size={14} />
              </button>
              <span className="text-xs text-gray-400">
                {comment.upvotes} upvotes • {comment.downvotes} downvotes
              </span>
            </div>
          </>
        )}

        {showReplyBox && !collapsed && (
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

        {comment.replies && comment.replies.length > 0 && !collapsed && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                vote={vote}
                addReply={addReply}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
