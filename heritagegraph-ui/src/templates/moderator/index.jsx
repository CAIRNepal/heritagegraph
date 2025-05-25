import React, { useEffect, useState } from "react";
import axios from "axios";
import { Spin, Button, Table } from "antd";
import Layout from '../../components/Layout';
import config from '../../assets/config';
import { Link } from "react-router-dom";

const Moderator = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('https://nchlod.ddev.site/jsonapi/webform_submission/nchlod1')
      .then(response => {
        if (response.data && response.data.data) {
          const ids = response.data.data.map(submission => submission.id);
          setSubmissions(ids);
          setLoading(false);
        } else {
          setError('Unexpected response structure');
          setLoading(false);
        }
      })
      .catch(error => {
        setError(error);
        setLoading(false);
      });
  }, []);

  const handleApprove = (id) => {
    console.log(`Approved submission with ID: ${id}`);
  };

  const handleReject = (id) => {
    console.log(`Rejected submission with ID: ${id}`);
  };

  const columns = [
    {
      title: "UUID",
      dataIndex: "uuid",
      key: "uuid",
    },
    {
      title: "Actions",
      key: "actions",
      render: (text, record) => (
        <span>
          <Link to={`/viewresponse/${record.uuid}`}>
            <Button>View Form</Button>
          </Link>
          <Button onClick={() => handleApprove(record.uuid)} style={{ marginLeft: 8 }}>Approve</Button>
          <Button onClick={() => handleReject(record.uuid)} style={{ marginLeft: 8 }}>Reject</Button>
        </span>
      ),
    },
  ];

  const data = submissions.map((uuid, index) => ({
    key: index,
    uuid,
  }));

  return (
    <Layout title="Moderate">
      <div className={`dc-page ${config.container}`}>
        <h1>Moderate Heritage Graph</h1>
        <div className="dc-page-content row">
          {loading ? (
            <Spin />
          ) : error ? (
            <p>Error loading submissions: {error.message}</p>
          ) : (
            <Table columns={columns} dataSource={data} bordered />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Moderator;
