import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import config from "../../assets/config";
import { Input, Space, Button, Table, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";

const Leaderboard = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef(null);

  // Fetch data from API
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get("/data/leaderboard"); // Uses Vite proxy
        setLeaderboardData(response.data);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
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
    filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? "#076096" : undefined }} />,
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
        let rankLabel = "";
        if (rank === 1) {
          rankLabel = <Tag color="#b07f00">🥇 1st</Tag>; // Gold
        } else if (rank === 2) {
          rankLabel = <Tag color="#8a8a8a">🥈 2nd</Tag>; // Silver
        } else if (rank === 3) {
          rankLabel = <Tag color="#704214">🥉 3rd</Tag>; // Bronze
        } else {
          rankLabel = <span>{rank}</span>;
        }
        return rankLabel;
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

  return (
    <Layout title="Leaderboard">
      <div className={`dc-page ${config.container}`}>
        <h1>Leaderboard</h1>
        <div className="dc-page-content row">
          <div className="col-md-12 col-sm-12">
            <Table
              columns={columns}
              dataSource={leaderboardData}
              bordered
              scroll={{ x: 1200, y: 600 }}
              loading={loading}
              rowClassName={(record) => {
                const rank = record.rank;
                if (rank === 1) return "bg-darkgold"; // Custom dark gold class
                if (rank === 2) return "bg-darksilver"; // Custom dark silver class
                if (rank === 3) return "bg-darkbronze"; // Custom dark bronze class
                return "";
              }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Leaderboard;
