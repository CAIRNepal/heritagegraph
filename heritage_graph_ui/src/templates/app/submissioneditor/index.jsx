import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppLayout from '../../../components/AppLayout';
import config from '../../../assets/config';
import {
  Form, Input, Button, Alert, Typography, Card, Row, Col, Divider, Space, Switch, Spin, Select
} from 'antd';
import { useSearchParams, useNavigate } from "react-router-dom";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const SubmissionEditor = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const submissionId = searchParams.get("submissionId");

  const [form] = Form.useForm();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [original, setOriginal] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState('split');
  const [diff, setDiff] = useState([]);

  const [liveTitle, setLiveTitle] = useState('');
  const [liveDescription, setLiveDescription] = useState('');

  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Diff calculation function (line-by-line)
  const getDiff = (originalText, modifiedText) => {
    const oLines = originalText.split("\n");
    const mLines = modifiedText.split("\n");
    const diffResult = [];
    let i = 0, j = 0;

    while (i < oLines.length || j < mLines.length) {
      if (i < oLines.length && j < mLines.length && oLines[i] === mLines[j]) {
        diffResult.push({ type: "same", original: oLines[i], modified: mLines[j] });
        i++; j++;
      } else if (i < oLines.length && j < mLines.length) {
        diffResult.push({ type: "edited", original: oLines[i], modified: mLines[j] });
        i++; j++;
      } else if (i < oLines.length) {
        diffResult.push({ type: "removed", original: oLines[i] });
        i++;
      } else if (j < mLines.length) {
        diffResult.push({ type: "added", modified: mLines[j] });
        j++;
      }
    }

    return diffResult;
  };

  // Update diff and hasChanges whenever original or live text changes
  useEffect(() => {
    if (original) {
      const originalTitle = original.title?.trim() || '';
      const originalDescription = original.description?.trim() || '';
      const currentTitle = liveTitle.trim();
      const currentDescription = liveDescription.trim();

      const isChanged = originalTitle !== currentTitle || originalDescription !== currentDescription;
      setHasChanges(isChanged);

      const originalText = `${originalTitle}\n\n${originalDescription}`;
      const modifiedText = `${currentTitle}\n\n${currentDescription}`;
      setDiff(getDiff(originalText, modifiedText));
    }
  }, [original, liveTitle, liveDescription]);

  // Load submissions list or single submission + suggestions based on submissionId
  useEffect(() => {
    setError('');
    setSuccess('');
    if (!submissionId) {
      setLoadingSubmissions(true);
      axios.get('/data/submissions/')
        .then(res => {
          if (Array.isArray(res.data)) {
            setSubmissions(res.data);
          } else {
            setError("Invalid submissions data format.");
            setSubmissions([]);
          }
        })
        .catch(() => setError("Failed to fetch submissions."))
        .finally(() => setLoadingSubmissions(false));
      return;
    }

    // Load submission details
    axios.get(`/data/submissions/${submissionId}/`)
      .then(res => {
        const data = res.data;
        setOriginal(data);
        setLiveTitle(data.title || '');
        setLiveDescription(data.description || '');
        form.setFieldsValue({
          title: data.title || '',
          description: data.description || '',
          field1: data.contribution_data?.field1 || '',
          field2: data.contribution_data?.field2 || '',
        });
      })
      .catch(() => setError('Failed to fetch submission data.'));

    // Load suggestions
    axios.get(`/data/submissions/${submissionId}/edit-suggestions`)
      .then(res => {
        const suggestionsData = res.data;
        if (Array.isArray(suggestionsData)) {
          setSuggestions(suggestionsData);
          if (suggestionsData.length > 0) {
            // Select first suggestion's id if it exists
            setSelectedId(suggestionsData[0]?.submission_id || null);
          } else {
            setSelectedId(null);
          }
        } else {
          setSuggestions([]);
          setSelectedId(null);
        }
      })
      .catch(() => setError('Failed to load suggestions.'));
  }, [submissionId, form]);

  // Form submission handler
  const handleSubmit = async () => {
    if (!submissionId) {
      setError("No submission selected. Please choose a submission first.");
      return;
    }

    try {
      const values = await form.validateFields();
      setLoading(true);
      setError('');
      setSuccess('');

      const payload = {
        submission: submissionId,
        title: values.title,
        description: values.description,
        contribution_data: {
          field1: values.field1,
          field2: values.field2,
        },
      };

      const response = await axios.post(
        `/data/submission-suggestions/`,
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.status === 201 || response.status === 200) {
        setSuccess('Suggestion submitted successfully!');
        form.resetFields();
        // Reset live title and description to empty to avoid confusion
        setLiveTitle('');
        setLiveDescription('');
      } else {
        setError('Failed to submit suggestion.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  // Render Select for submissions if no submissionId in URL
  if (!submissionId) {
    return (
      <AppLayout title="Choose Submission">
        <Card style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Title level={3} style={{ textAlign: 'center', color: config.primaryColor, textTransform: 'uppercase' }}>
            Select a Submission to Suggest Edits
          </Title>
          {loadingSubmissions ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Spin size="large" />
            </div>
          ) : (
            <Select
              showSearch
              placeholder="Choose a submission below to begin suggesting improvements..."
              optionFilterProp="children"
              onChange={(selectedSubmissionId) => {
                navigate(`?submissionId=${selectedSubmissionId}`);
              }}
              style={{
                width: '100%',
                fontSize: 16,
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                height: 60,
                display: 'flex',
                alignItems: 'center',
              }}
              size="large"
              listHeight={400}
              dropdownStyle={{ borderRadius: 12, maxHeight: 500, overflow: 'auto' }}
              filterOption={(input, option) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
              value={null}
            >
              {submissions.map((s) => (
                <Option key={s.submission_id} value={s.submission_id}>
                  <Text strong>{s.title}</Text>
                </Option>
              ))}
            </Select>
          )}
        </Card>
      </AppLayout>
    );
  }

  // Main form and diff view rendering
  return (
    <AppLayout title="Suggest an Edit">
      <div className={`dc-page ${config.container}`}>
        <Title level={2}>Suggest an Edit</Title>
        <Paragraph>Propose changes to improve this submission. Your suggestion will be reviewed by moderators.</Paragraph>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Updated Title" name="title" rules={[{ required: true }]}>
            <Input
              placeholder="Enter updated title"
              onChange={e => setLiveTitle(e.target.value)}
              value={liveTitle}
            />
          </Form.Item>
          <Form.Item label="Updated Description" name="description" rules={[{ required: true }]}>
            <TextArea
              rows={4}
              placeholder="Enter updated description"
              onChange={e => setLiveDescription(e.target.value)}
              value={liveDescription}
            />
          </Form.Item>
          <Form.Item label="Field 1" name="field1" rules={[{ required: true }]}>
            <Input placeholder="New value for field1" />
          </Form.Item>
          <Form.Item label="Field 2" name="field2" rules={[{ required: true }]}>
            <Input type="number" placeholder="New value for field2" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Submit Suggestion</Button>
          </Form.Item>
        </Form>

        {error && <Alert message={error} type="error" showIcon style={{ marginTop: 16 }} />}
        {success && <Alert message={success} type="success" showIcon style={{ marginTop: 16 }} />}

        <Divider />

        <Card
          title={
            <Space style={{ justifyContent: "space-between", width: "100%" }}>
              <Title level={4} style={{ color: config.primaryColor, margin: 0 }}>Live Preview Diff</Title>
              <Switch
                checkedChildren="Split"
                unCheckedChildren="Inline"
                checked={viewMode === "split"}
                onChange={(checked) => setViewMode(checked ? "split" : "inline")}
              />
            </Space>
          }
        >
          {!original ? (
            <Spin size="large" />
          ) : viewMode === "inline" ? (
            <div>
              {Array.isArray(diff) && diff.length > 0 ? diff.map((item, index) => {
                const baseStyle = { marginBottom: 12 };
                if (item.type === "same") {
                  return <Paragraph key={index} style={baseStyle}>{item.original}</Paragraph>;
                } else if (item.type === "edited") {
                  return (
                    <Paragraph key={index} style={{ ...baseStyle, backgroundColor: '#fff5b1' }}>
                      <Text delete>{item.original}</Text> <Text strong>{item.modified}</Text>
                    </Paragraph>
                  );
                } else if (item.type === "added") {
                  return (
                    <Paragraph key={index} style={{ ...baseStyle, backgroundColor: '#d0ffd6' }}>
                      <Text strong>{item.modified}</Text>
                    </Paragraph>
                  );
                } else if (item.type === "removed") {
                  return (
                    <Paragraph key={index} style={{ ...baseStyle, backgroundColor: '#ffd6d6' }}>
                      <Text delete>{item.original}</Text>
                    </Paragraph>
                  );
                } else {
                  return null;
                }
              }) : <Paragraph>No differences detected.</Paragraph>}
            </div>
          ) : (
            <Row gutter={24}>
              <Col span={12}>
                <Card title="Original">
                  <Title level={5}>{original.title}</Title>
                  <Paragraph>{original.description}</Paragraph>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Modified">
                  <Title level={5}>{liveTitle}</Title>
                  <Paragraph>{liveDescription}</Paragraph>
                </Card>
              </Col>
            </Row>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default SubmissionEditor;
