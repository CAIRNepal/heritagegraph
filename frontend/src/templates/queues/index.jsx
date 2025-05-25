import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import config from "../../assets/config";
import { Input, Space, Button, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";
import { useNavigate } from "react-router-dom";  

const Queues = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef(null);
  const navigate = useNavigate();  

  // Fetch data from the submissions API
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:8000/data/submissions/");
        if (response.status === 200) {
          // Filter only "pending" submissions
          const pendingSubmissions = response.data
            .filter((submission) => submission.status.toLowerCase() === "pending")
            .map((submission, index) => ({
              key: index + 1, // Table requires a unique key
              id: submission.id,
              title: submission.title,
              description: submission.description,
              contributor: submission.contributor_username, 
              status: submission.status,
              created_at: new Date(submission.created_at).toLocaleDateString(), // Formatting the date
            }));
          setData(pendingSubmissions);
        } else {
          console.error("Unexpected response:", response);
        }
      } catch (error) {
        console.error("Error fetching submissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
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

  const handleContributorClick = (username) => {
    // Navigate to the user's profile page using their username
    navigate(`/view/${username}`);
  };

  // Handle title click: Navigate to /view/:title
  const handleTitleClick = (title) => { 
    navigate(`/viewform/${title}`);  // Navigate to the title's page
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: true,
      key: "id",
      width: "10%",
      ...getColumnSearchProps("id"),
    },
    {
      title: "Title",
      dataIndex: "title",
      sorter: true,
      key: "title",
      width: "20%",
      ...getColumnSearchProps("title"),
      render: (text) => (
        <Button
          type="link"
          onClick={() => handleTitleClick(text)} // Handle click to navigate to the title's page
        >
          {text}
        </Button>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      sorter: true,
      key: "description",
      width: "30%",
      ...getColumnSearchProps("description"),
    },
    {
      title: "Contributor",
      dataIndex: "contributor",
      sorter: true,
      key: "contributor",
      width: "20%",
      ...getColumnSearchProps("contributor"),
      render: (text) => (
        <Button
          type="link"
          onClick={() => handleContributorClick(text)} // Handle click to navigate to profile
        >
          {text}
        </Button>
      ),
    },
    {
      title: "Created At",
      dataIndex: "created_at",
      sorter: true,
      key: "created_at",
      width: "20%",
      ...getColumnSearchProps("created_at"),
    },
  ];

  return (
    <Layout title="Queues">
      <div className={`dc-page ${config.container}`}>
        <h1>Pending Submissions</h1>
        <div className="dc-page-content row">
          <div className="col-md-12 col-sm-12">
            <Table
              columns={columns}
              dataSource={data}
              bordered
              scroll={{ x: 1200, y: 600 }}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Queues;
