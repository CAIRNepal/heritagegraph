import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import config from "../../assets/config";
import { Input, Space, Button, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";

const Leaderboard = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef(null);

  // Fetch leaderboard data from API
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:8000/data/leaderboard/");
        setLeaderboardData(response.data);
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  // Search functionality for the username column
  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  // Handle reset by refreshing the page
  const handleReset = () => {
    window.location.reload(); // Refresh the page to reset the table and its state
  };

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => (
      <div style={{ padding: 8 }}>
        <Input
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
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
            onClick={handleReset} // Trigger page refresh to reset
            size="small"
            style={{ width: 90 }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? "#076096" : undefined }} />
    ),
    onFilter: (value, record) =>
      record[dataIndex].toString().toLowerCase().includes(value.toLowerCase()),
    onFilterDropdownVisibleChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current.select(), 100);
      }
    },
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

  // Define columns for the leaderboard table
  const columns = [
    {
      title: "Rank",
      dataIndex: "rank",
      key: "rank",
      sorter: (a, b) => a.rank - b.rank, // Correct sorting based on rank
      width: "10%",
      render: (rank) => {
        let rankStyle = "";
        if (rank === 1) rankStyle = "text-red-600 font-bold"; // Red for 1st place
        if (rank === 2) rankStyle = "text-yellow-600 font-semibold"; // Yellow for 2nd place
        if (rank === 3) rankStyle = "text-green-600 font-medium"; // Green for 3rd place
        return <span className={rankStyle}>{rank}</span>;
      },
    },
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
      sorter: true, // Sorting enabled
      width: "20%",
      ...getColumnSearchProps("username"), // Add search functionality for username column
    },
    {
      title: "Total Submissions",
      dataIndex: "total_submissions",
      key: "total_submissions",
      sorter: (a, b) => a.total_submissions - b.total_submissions, // Sorting based on total submissions
      width: "20%",
    },
    {
      title: "Accepted Submissions",
      dataIndex: "accepted_submissions",
      key: "accepted_submissions",
      sorter: (a, b) => a.accepted_submissions - b.accepted_submissions, // Sorting based on accepted submissions
      width: "20%",
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      sorter: (a, b) => a.score - b.score, // Sorting based on score
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
              columns={columns} // Using columns with sorting enabled
              dataSource={leaderboardData}
              bordered
              scroll={{ x: 1200, y: 600 }}
              loading={loading}
              rowClassName={(record) => {
                const rank = record.rank;
                if (rank === 1) return "bg-red-50"; // Background for rank 1
                if (rank === 2) return "bg-yellow-50"; // Background for rank 2
                if (rank === 3) return "bg-green-50"; // Background for rank 3
                return ""; // Default for other rows
              }}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Leaderboard;
