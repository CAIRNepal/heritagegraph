import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Card, Typography, Button, Spin, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../../components/AppLayout';
import moment from 'moment';

const { Title } = Typography;

const QueuePage = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('http://127.0.0.1:8000/data/submissions')
      .then((res) => setQueue(res.data))
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch queue.");
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: 'Submission Title',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: 'Contributor',
      dataIndex: 'contributor_username',
      key: 'contributor_username',
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => (
        <div>
          <div>{moment(text).fromNow()}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {moment(text).format('YYYY-MM-DD HH:mm')}
          </div>
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          onClick={() => navigate(`/suggestedit?submissionId=${record.submission_id}`)}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <AppLayout title="Review Queue">
      <div style={{ background: '#f5f5f5', padding: '24px', minHeight: '100vh' }}>
        <Card
          style={{
            maxWidth: '100%',
            margin: '0 auto',
            borderRadius: 10,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            background: '#fff',
          }}
          bodyStyle={{ padding: '24px' }}
        >
          <Title level={3} style={{ marginBottom: 24 }}>Pending Suggestions</Title>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <Spin size="large" />
            </div>
          ) : error ? (
            <Alert message={error} type="error" />
          ) : (
            <Table
              rowKey="submission_id"
              dataSource={queue}
              columns={columns}
              pagination={{ pageSize: 10 }}
              bordered
              size="middle"
              style={{
                background: '#fff',
                borderRadius: 6,
              }}
            />
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default QueuePage;
