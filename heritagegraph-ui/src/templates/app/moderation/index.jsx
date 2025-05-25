import React, { useEffect, useState } from "react";
import {
  Card, Typography, Switch, Row, Col, Divider, Space, Select, Spin, Button
} from "antd";
import AppLayout from "../../../components/AppLayout";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from 'axios';
import config from "../../../assets/config";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const DiffViewer = () => {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("submissionId");
  const navigate = useNavigate();

  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [original, setOriginal] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState("split");
  const [diff, setDiff] = useState([]);

  const getDiff = (originalText, modifiedText) => {
    const oLines = originalText.split("\n");
    const mLines = modifiedText.split("\n");

    const diff = [];
    let i = 0, j = 0;

    while (i < oLines.length || j < mLines.length) {
      if (i < oLines.length && j < mLines.length && oLines[i] === mLines[j]) {
        diff.push({ type: "same", original: oLines[i], modified: mLines[j] });
        i++; j++;
      } else if (i < oLines.length && j < mLines.length) {
        diff.push({ type: "edited", original: oLines[i], modified: mLines[j] });
        i++; j++;
      } else if (i < oLines.length) {
        diff.push({ type: "removed", original: oLines[i] });
        i++;
      } else if (j < mLines.length) {
        diff.push({ type: "added", modified: mLines[j] });
        j++;
      }
    }

    return diff;
  };

  useEffect(() => {
    if (!slug) {
      setLoadingSubmissions(true);
      axios.get('/data/submissions/')
        .then(res => setSubmissions(res.data))
        .catch(err => console.error("Failed to fetch submissions", err))
        .finally(() => setLoadingSubmissions(false));
      return;
    }

    const fetchData = async () => {
      const [originalRes, suggestionsRes] = await Promise.all([
        fetch(`/data/submissions/${slug}`),
        fetch(`/data/submissions/${slug}/edit-suggestions`)
      ]);
      const originalData = await originalRes.json();
      const suggestionsData = await suggestionsRes.json();

      setOriginal(originalData);
      setSuggestions(suggestionsData);
      if (suggestionsData.length > 0) {
        setSelectedId(suggestionsData[0].id);
      }
    };

    fetchData();
  }, [slug]);

  useEffect(() => {
    if (original && selectedId !== null) {
      const selectedSuggestion = suggestions.find(s => s.id === selectedId);
      if (selectedSuggestion) {
        const originalText = `${original.title}\n\n${original.description}`;
        const modifiedText = `${selectedSuggestion.title}\n\n${selectedSuggestion.description}`;
        setDiff(getDiff(originalText.trim(), modifiedText.trim()));
      }
    }
  }, [original, selectedId]);

  if (!slug) return (
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
              fontSize: '16px',
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

  if (!original || suggestions.length === 0) return (
    <AppLayout title="No Submission Found">
      <Card style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Title level={3} style={{ textAlign: 'center', color: config.primaryColor, fontWeight: 'bold', marginBottom: '20px' }}>
          No Versions Available to Edit for This Submission
        </Title>
        <Paragraph style={{ textAlign: 'center', color: '#8c8c8c', fontSize: '16px', marginBottom: '30px' }}>
          It seems that there are no versions or edit suggestions available for this submission yet. You can check back later or make a new submission to get started.
        </Paragraph>
        <Space style={{ justifyContent: 'center', width: '100%', marginTop: 20 }}>
          <Button type="primary" onClick={() => navigate('/')} style={{ padding: '0 20px' }}>
            Return to Home
          </Button>
          <Button onClick={() => navigate('/diffviewer')} style={{ marginLeft: 10, padding: '0 20px' }}>
            Return to Diff Viewer
          </Button>
        </Space>
      </Card>
    </AppLayout>
  );

  return (
    <AppLayout title="Compare Submission Edits">
      <Card
        title={
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Title level={4} style={{ color: config.primaryColor, margin: 0 }}>
              Compare Edits
            </Title>
            <Space>
              <Select
                value={selectedId}
                onChange={setSelectedId}
                style={{ minWidth: 250 }}
                placeholder="Select an edit suggestion"
              >
                {suggestions.map((s) => (
                  <Option key={s.id} value={s.id}>
                    {s.title} — by {s.suggested_by}
                  </Option>
                ))}
              </Select>
              <Switch
                checkedChildren="Split"
                unCheckedChildren="Inline"
                checked={viewMode === "split"}
                onChange={(checked) => setViewMode(checked ? "split" : "inline")}
              />
            </Space>
          </Space>
        }
        style={{
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        }}
      >
        {viewMode === "inline" ? (
          <div>
            {diff.map((item, index) => {
              const baseStyle = { marginBottom: 12 };
              if (item.type === "same") {
                return <Paragraph key={index} style={baseStyle}>{item.original}</Paragraph>;
              } else if (item.type === "removed") {
                return <Paragraph key={index} type="danger" delete style={{ ...baseStyle, backgroundColor: "#fff1f0", padding: "4px 8px" }}>{item.original}</Paragraph>;
              } else if (item.type === "added") {
                return <Paragraph key={index} style={{ ...baseStyle, backgroundColor: "#e6fffb", padding: "4px 8px", color: "#08979c" }}>{item.modified}</Paragraph>;
              } else {
                return (
                  <div key={index}>
                    <Paragraph type="danger" delete style={{ ...baseStyle, backgroundColor: "#fff1f0", padding: "4px 8px" }}>{item.original}</Paragraph>
                    <Paragraph style={{ ...baseStyle, backgroundColor: "#e6fffb", padding: "4px 8px", color: "#08979c" }}>{item.modified}</Paragraph>
                  </div>
                );
              }
            })}
          </div>
        ) : (
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>Original</Text>
              <Divider />
              {diff.map((item, index) => (
                <Paragraph
                  key={index}
                  type={item.type === "removed" || item.type === "edited" ? "danger" : undefined}
                  delete={item.type === "removed"}
                  style={{
                    backgroundColor: (item.type === "removed" || item.type === "edited") ? "#fff1f0" : "transparent",
                    padding: "4px 8px",
                    marginBottom: 12,
                  }}
                >
                  {item.original || ""}
                </Paragraph>
              ))}
            </Col>
            <Col span={12}>
              <Text strong>Modified</Text>
              <Divider />
              {diff.map((item, index) => (
                <Paragraph
                  key={index}
                  style={{
                    backgroundColor: (item.type === "added" || item.type === "edited") ? "#e6fffb" : "transparent",
                    padding: "4px 8px",
                    color: (item.type === "added" || item.type === "edited") ? "#08979c" : undefined,
                    marginBottom: 12,
                  }}
                >
                  {item.modified || ""}
                </Paragraph>
              ))}
            </Col>
          </Row>
        )}
      </Card>
    </AppLayout>
  );
};

export default DiffViewer;
