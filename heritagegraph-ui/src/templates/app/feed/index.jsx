import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../../../components/AppLayout";
import { Card, Input, Spin, List, Typography, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
// import './index.css';
const { Title, Paragraph, Text } = Typography;

const ExploreFeed = () => {
  const [feedData, setFeedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/data/submissions");
        const data = await response.json();
        const formattedData = data.map((item) => ({
          id: item.submission_id,
          title: item.title,
          description: item.description,
          author: item.contributor_username,
          date: item.created_at,
        }));
        setFeedData(formattedData);
      } catch (error) {
        console.error("Error fetching submissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredData = feedData.filter(
    (item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCardClick = (id) => {
    navigate(`/explore/${id}`);
  };

  return (
    <AppLayout title="Explore Feed">
      <div style={{ padding: "24px", fontFamily: '"Proxima Centauri", "Poppins", sans-serif' }}>
        <Input
          placeholder="🔍 Search posts..."
          prefix={<SearchOutlined />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            marginBottom: 24,
            padding: "10px 16px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            fontSize: "16px"
          }}
        />
        {loading ? (
          <div style={{ textAlign: "center", marginTop: 80 }}>
            <Spin size="large" />
          </div>
        ) : (
          <List
            grid={{ gutter: 24, column: 3 }}
            dataSource={filteredData}
            style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}
            renderItem={(item) => (
              <List.Item key={item.id}>
                <Card
                  hoverable
                  onClick={() => handleCardClick(item.id)}
                  style={{
                    cursor: "pointer",
                    borderRadius: "16px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
                    transition: "transform 0.2s ease",
                  }}
                  bodyStyle={{ minHeight: "200px" }}
                >
                  <Title level={4} style={{ marginBottom: 8 }}>{item.title}</Title>
                  <Paragraph ellipsis={{ rows: 3 }}>{item.description}</Paragraph>
                  <div style={{ marginTop: 12 }}>
                    <Tag color="blue">{item.author}</Tag>
                    <Text type="secondary" style={{ float: "right" }}>
                      {new Date(item.date).toLocaleDateString()}
                    </Text>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default ExploreFeed;
