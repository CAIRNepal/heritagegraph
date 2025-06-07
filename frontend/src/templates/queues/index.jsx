import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import config from "../../assets/config";
import { Input, Space, Button, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";
import { useNavigate } from "react-router-dom";
import "./index.css";

const Queues = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/data/submissions`);
        setData(response.data);
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
            className="button-custom"
          >
            Search
          </Button>
          <Button
            onClick={() => handleReset(clearFilters)}
            size="small"
            style={{ width: 90 }}
            className="button-custom"
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? "#076096" : undefined }} />,
    onFilter: (value, record) => record[dataIndex].toString().toLowerCase().includes(value.toLowerCase()),
    onFilterDropdownVisibleChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current.select(), 100);
      }
    },
    render: (text) =>
      searchedColumn === dataIndex ? (
        <Highlighter highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }} searchWords={[searchText]} autoEscape textToHighlight={text ? text.toString() : ""} />
      ) : (
        text
      ),
  });

  const handleContributorClick = (username) => {
    navigate(`/view/${username}`);
  };

  const handleTitleClick = (title) => {
    navigate(`/viewform/${title}`);
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
        <Button type="link" onClick={() => handleTitleClick(text)} className="button-custom">
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
      dataIndex: "contributor_username",
      sorter: true,
      key: "contributor_username",
      width: "20%",
      ...getColumnSearchProps("contributor_username"),
      render: (text) => (
        <Button type="link" onClick={() => handleContributorClick(text)} className="button-custom">
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
      render: (text) => new Date(text).toLocaleString(), // Convert timestamp to readable format
      ...getColumnSearchProps("created_at"),
    },
  ];

  return (
    <Layout title="Queues">
      <div className={`dc-page ${config.container}`}>
        <h1>Pending Submissions</h1>
        <div className="dc-page-content row">
          <div className="col-md-12 col-sm-12">
            <Table columns={columns} dataSource={data} bordered scroll={{ x: 1200, y: 600 }} loading={loading} rowKey="id" />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Queues;
