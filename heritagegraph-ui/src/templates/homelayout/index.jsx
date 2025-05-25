import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import AppLayout from "../../components/AppLayout";
import config from "../../assets/config";
import { Input, Space, Button, Table, Tag, Card, Row, Col, Statistic } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";

const Dashboard = () => {
  const [homeData, setHomeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef(null);

  const currentUsername = "nabin2004";  

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get("/data/leaderboard/");
        setHomeData(response.data);
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
      } finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, []);
  
  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters();
    setSearchText("");
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Search
          </Button>
          <Button
            onClick={() => handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex]?.toString().toLowerCase().includes(value.toLowerCase()),
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ""}
        />
      ) : (
        text
      ),
  });

  const columns = [
    {
      title: "Rank",
      dataIndex: "rank",
      key: "rank",
      sorter: (a, b) => a.rank - b.rank,
      width: "10%",
      render: (rank) => {
        if (rank === 1) return <Tag color="gold">🥇 1st</Tag>;
        if (rank === 2) return <Tag color="silver">🥈 2nd</Tag>;
        if (rank === 3) return <Tag color="brown">🥉 3rd</Tag>;
        return <span>{rank}</span>;
      },
    },
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
      sorter: (a, b) => a.username.localeCompare(b.username),
      width: "20%",
      ...getColumnSearchProps("username"),
    },
    {
      title: "Total Submissions",
      dataIndex: "total_submissions",
      key: "total_submissions",
      sorter: (a, b) => a.total_submissions - b.total_submissions,
      width: "20%",
    },
    {
      title: "Accepted Submissions",
      dataIndex: "accepted_submissions",
      key: "accepted_submissions",
      sorter: (a, b) => a.accepted_submissions - b.accepted_submissions,
      width: "20%",
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      sorter: (a, b) => a.score - b.score,
      width: "20%",
    },
  ];

  const totalSubmissions = homeData.reduce((sum, user) => sum + (user.total_submissions || 0), 0);
  const totalAccepted = homeData.reduce((sum, user) => sum + (user.accepted_submissions || 0), 0);
  const averageScore = homeData.length > 0
    ? (homeData.reduce((sum, user) => sum + (user.score || 0), 0) / homeData.length).toFixed(2)
    : 0;

  const yourData = homeData.find(user => user.username === currentUsername);
  const yourRank = yourData ? yourData.rank : "N/A";

  return (
    <AppLayout title="Dashboard">
      <div style={{ padding: "24px", background: "#f4f7fb", borderRadius: "8px" }}>
        <h1 style={{ marginBottom: "24px", color: "#333" }}>Home Dashboard</h1>

        <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
          <Col xs={24} sm={12} md={6}>
            <Card
              style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
            >
              <Statistic title="Your Rank" value={yourRank} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
            >
              <Statistic title="Total Submissions" value={totalSubmissions} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
            >
              <Statistic title="Accepted Submissions" value={totalAccepted} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
            >
              <Statistic title="Average Score" value={averageScore} precision={2} />
            </Card>
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '34px' }}>
          <Space>
            <Button type="primary" href="/submissions" style={{ borderRadius: "8px" }}>
              Explore Submissions
            </Button>
            <Button type="default" href="/queues" style={{ borderRadius: "8px" }}>
              Explore Queues
            </Button>
          </Space>
        </div>

        <Card
          style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
        >
          <Table
            columns={columns}
            dataSource={homeData}
            bordered
            scroll={{ x: 1200, y: 600 }}
            loading={loading}
            rowKey="id"
            rowClassName={(record) => {
              const rank = record.rank;
              if (rank === 1) return "bg-darkgold";
              if (rank === 2) return "bg-darksilver";
              if (rank === 3) return "bg-darkbronze";
              return "";
            }}
          />
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
