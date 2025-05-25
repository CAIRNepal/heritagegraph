import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "../../../components/AppLayout";
import {
  Card,
  Tooltip,
  Avatar,
  Row,
  Col,
  Typography,
  Space,
  Input,
  Button,
  message,
} from "antd";
import {
  LikeOutlined,
  LikeFilled,
  DislikeOutlined,
  DislikeFilled,
} from "@ant-design/icons";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const Explore = () => {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [action, setAction] = useState(null);

  useEffect(() => {
    if (!submissionId) return;

    fetch(`/data/submissions/${submissionId}`)
      .then((res) => res.json())
      .then((data) => {
        setSubmission(data);
        if (data.comments) {
          const formattedComments = data.comments.map((c) => ({
            id: c.id,
            author: c.user,
            avatar: "https://joeschmoe.io/api/v1/random",
            content: c.comment,
            datetime: new Date(c.created_at).toLocaleString(),
          }));
          setComments(formattedComments);
        }
      })
      .catch((err) => {
        console.error(err);
        message.error("Failed to load submission.");
      });
  }, [submissionId]);

  const like = () => {
    setLikes((prev) => (action === "liked" ? prev : prev + 1));
    if (action === "disliked") setDislikes((prev) => prev - 1);
    setAction("liked");
  };

  const dislike = () => {
    setDislikes((prev) => (action === "disliked" ? prev : prev + 1));
    if (action === "liked") setLikes((prev) => prev - 1);
    setAction("disliked");
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const newCommentObj = {
      id: Date.now(),
      author: "NewUser",
      avatar: "https://joeschmoe.io/api/v1/random",
      content: newComment,
      datetime: "Just now",
    };

    setComments([newCommentObj, ...comments]);
    setNewComment("");
  };

  const renderActions = () => (
    <Space>
      <Tooltip title="Like">
        <span onClick={like} style={{ cursor: "pointer" }}>
          {React.createElement(action === "liked" ? LikeFilled : LikeOutlined)} {likes}
        </span>
      </Tooltip>
      <Tooltip title="Dislike">
        <span onClick={dislike} style={{ cursor: "pointer" }}>
          {React.createElement(action === "disliked" ? DislikeFilled : DislikeOutlined)} {dislikes}
        </span>
      </Tooltip>
    </Space>
  );

  return (
    <AppLayout title="Post View">
      <div>
        {submission ? (
          <Card title={submission.title} style={{ marginBottom: 32 }}>
            <Paragraph>{submission.description}</Paragraph>
            <Text strong>By:</Text> {submission.contributor_username}
            <br />
            <Text type="secondary">
              {new Date(submission.created_at).toLocaleDateString()}
            </Text>
          </Card>
        ) : (
          <Paragraph>Loading submission...</Paragraph>
        )}
        {submission && (
  <div style={{ marginBottom: 24 }}>
<Space wrap style={{ marginBottom: 16 }}>
  <Button type="default" href={`/suggestedit?submissionId=${submissionId}`}>
    Suggest Edit
  </Button>
  <Button type="default" href={`/version?submissionId=${submissionId}`}>
    Version History
  </Button>
  <Button type="default" href={`/diffviewer?submissionId=${submissionId}`}>
    Diff Viewer
  </Button>
  <Button type="default" href={`/feed?submissionId=${submissionId}`}>
    Feed
  </Button>
</Space>
  </div>
)}


        <Card title="Comments" style={{ marginTop: 16 }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {comments.map((c) => (
              <Row key={c.id} gutter={16} align="middle" style={{ marginBottom: 16 }}>
                <Col>
                  <Avatar src={c.avatar} alt={c.author} />
                </Col>
                <Col flex="auto">
                  <Text strong>{c.author}</Text>
                  <br />
                  <Text>{c.content}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {c.datetime}
                  </Text>
                </Col>
              </Row>
            ))}
          </Space>

          <TextArea
            rows={4}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            style={{ margin: "24px 0 12px 0" }}
          />
          <Button type="primary" onClick={handleAddComment} block>
            Post Comment
          </Button>
        </Card>

        <div style={{ marginTop: 24 }}>{renderActions()}</div>
      </div>
    </AppLayout>
  );
};

export default Explore;
