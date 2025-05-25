import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Input, Space, Button, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import Highlighter from "react-highlight-words";

const WebformSubmissionTable = ({ uuids }) => {
  const [submissionData, setSubmissionData] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [searchedColumn, setSearchedColumn] = useState("");
  const searchInput = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const responses = await Promise.all(
          uuids.map((uuid) =>
            axios.get(`https://nchlod.ddev.site/webform_rest/nchlod1/submission/${uuid}`)
          )
        );
        const data = responses.map((response) => response.data);
        console.log(data);
        setSubmissionData(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [uuids]);

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
      (record[dataIndex] || "")
        .toString()
        .toLowerCase()
        .includes(value.toLowerCase()),
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

  const columns = [
    {
      title: "UUID",
      dataIndex: "uuid",
      sorter: (a, b) => (a.uuid || "").localeCompare(b.uuid || ""),
      fixed: "left",
      key: "uuid",
      width: "15%",
      ...getColumnSearchProps("uuid"),
    },
    {
      title: "First Name",
      dataIndex: "first_name",
      sorter: (a, b) => (a.first_name || "").localeCompare(b.first_name || ""),
      key: "first_name",
      width: "15%",
      ...getColumnSearchProps("first_name"),
    },
    {
      title: "Last Name",
      dataIndex: "last_name",
      sorter: (a, b) => (a.last_name || "").localeCompare(b.last_name || ""),
      key: "last_name",
      width: "15%",
      ...getColumnSearchProps("last_name"),
    },
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a, b) => (a.email || "").localeCompare(b.email || ""),
      key: "email",
      width: "20%",
      ...getColumnSearchProps("email"),
    },
    {
      title: "Data Usage Consent",
      dataIndex: "i_permit_to_share_data",
      sorter: (a, b) =>
        (a.i_permit_to_share_data || "").localeCompare(b.i_permit_to_share_data || ""),
      key: "i_permit_to_share_data",
      fixed: "right",
      width: "15%",
      ...getColumnSearchProps("i_permit_to_share_data"),
    },
  ];

  const data = submissionData.map((submission) => ({
    key: submission.entity.uuid[0].value,
    uuid: submission.entity.uuid[0].value,
    first_name: submission.data.first_name || "",
    last_name: submission.data.last_name || "",
    email: submission.data.email || "",
    i_permit_to_share_data: submission.data.i_permit_to_share_data || "",
  }));

  return (
    <Table
      columns={columns}
      dataSource={data}
      bordered
      scroll={{ x: 1800, y: 1200 }}
      width={1200}
    />
  );
};

export default WebformSubmissionTable;
