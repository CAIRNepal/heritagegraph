import { Layout, Typography, Button, Row, Col, Card, Collapse } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { GraphDemoSection } from './GraphDemoSection';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

// Define your blue color once for consistency
const blueColor = '#1890ff';

export default function HeritageLandingPage() {
    return (
        <>
            {/* Add Inter font link in head */}
            <link
                href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
                rel="stylesheet"
            />
            <div
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    minHeight: '100vh',
                    fontFamily:
                        '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                    color: 'white',
                }}
            >
                {/* Background Graph */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100wh',
                        height: '100vh',
                        zIndex: 0,
                        overflow: 'hidden',
                    }}
                >
                    <GraphDemoSection />
                </div>

                {/* Main Layout */}
                <Layout
                    style={{
                        background: 'transparent',
                        position: 'relative',
                        zIndex: 1,
                        color: 'white',
                    }}
                >
                    {/* Header */}
                    <Header
                        style={{
                            background: 'rgba(0, 0, 0, 0.85)',
                            borderBottom: '1px solid #333',
                            padding: '0 48px',
                        }}
                    >
                        <Row justify="space-between" align="middle" style={{ height: '64px' }}>
                            <Title
                                level={4}
                                style={{
                                    margin: 0,
                                    color: blueColor,
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                }}
                            >
                                Heritage Graph
                            </Title>
                            <Row gutter={[16, 16]} align="middle" wrap>
                                {['Features', 'Use Cases', 'Technology'].map((item) => (
                                    <Col key={item}>
                                        <Button
                                            type="link"
                                            href={`#${item.toLowerCase().replace(' ', '')}`}
                                            style={{ color: blueColor, fontWeight: 600 }}
                                        >
                                            {item}
                                        </Button>
                                    </Col>
                                ))}
                                <Col>
                                    <Button
                                        type="primary"
                                        icon={<ArrowRightOutlined />}
                                        size="middle"
                                        style={{ backgroundColor: blueColor, borderColor: blueColor }}
                                    >
                                        Try Now
                                    </Button>
                                </Col>
                            </Row>
                        </Row>
                    </Header>

                    {/* Hero Section */}
                    <Content
                        style={{
                            minHeight: '50vh',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '3rem 1.5rem',
                        }}
                    >
                        <div
                            style={{
                                background: 'rgba(0, 0, 0, 0.5)',
                                padding: '3rem',
                                borderRadius: '1rem',
                                backdropFilter: 'blur(10px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                color: 'white',
                                maxWidth: '800px',
                                textAlign: 'center',
                            }}
                        >
                            <Title
                                style={{
                                    fontSize: '5rem',
                                    color: blueColor,
                                    textShadow: '1px 1px 10px rgba(0, 0, 0, 0.8)',
                                    marginBottom: '1rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.01em',
                                }}
                            >
                                Explore Cultural Heritage Like Never Before
                            </Title>
                            <Paragraph
                                style={{ fontSize: '2rem', color: '#ccc', marginBottom: '2rem' }}
                            >
                                A dynamic knowledge graph that connects historical sites, artifacts, and cultural
                                narratives in a visually intuitive interface.
                            </Paragraph>
                            <Button
                                type="primary"
                                size="large"
                                icon={<ArrowRightOutlined />}
                                style={{ backgroundColor: blueColor, borderColor: blueColor }}
                            >
                                Get Started
                            </Button>
                        </div>
                    </Content>

                    {/* Remaining Sections */}

                    {/* <Content style={{ padding: '80px 48px', background: '#111' }}>
            <Row justify="center">
              <Col xs={24} md={20}>
                <Title
                  level={2}
                  style={{
                    color: blueColor,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textAlign: 'center',
                  }}
                >
                  Why Heritage Graph?
                </Title>
                <Paragraph style={{ color: '#ccc' }}>
                  Cultural heritage is often trapped in static databases, scattered across
                  institutions, or locked behind PDFs. We believe this knowledge should be dynamic,
                  explorable, and interconnected—just like culture itself.
                </Paragraph>
                <Paragraph style={{ color: '#ccc' }}>
                  Whether you're a researcher, historian, or curator, Heritage Graph gives you a
                  powerful visual interface to explore relationships, timelines, and geographical
                  context—all in one place.
                </Paragraph>
              </Col>
            </Row>
          </Content> */}

                    <Content
                        id="features"
                        style={{ padding: '80px 48px', background: '#1111' }}
                    >
                        <Title
                            level={2}
                            style={{
                                textAlign: 'center',
                                marginBottom: 48,
                                color: blueColor,
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                            }}
                        >
                            Core Features
                        </Title>
                        <Row gutter={[32, 32]} justify="center">
                            {[
                                'Visual Knowledge Graph',
                                'Semantic Search',
                                'Data Upload & API',
                                'Temporal Navigation',
                                'Geo-spatial Awareness',
                                'Export & Embed',
                            ].map((title, index) => (
                                <Col xs={24} md={8} key={index}>
                                    <Card
                                        hoverable
                                        bordered={false}
                                        style={{ backgroundColor: '#111', color: 'white' }}
                                    >
                                        <Title level={4} style={{ color: blueColor, fontWeight: 600 }}>
                                            {title}
                                        </Title>
                                        <Paragraph style={{ color: '#ccc' }}>
                                            Feature description for {title}
                                        </Paragraph>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                    </Content>

                    <Content
                        id="usecases"
                        style={{ padding: '80px 48px', background: '#1111' }}
                    >
                        <Title
                            level={2}
                            style={{
                                textAlign: 'center',
                                color: blueColor,
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                            }}
                        >
                            Use Cases
                        </Title>
                        <Row
                            gutter={[32, 32]}
                            justify="center"
                            style={{ marginTop: 48 }}
                        >
                            {['Academic Research', 'Museum Curation', 'Public Archives'].map(
                                (title, i) => (
                                    <Col xs={24} md={6} key={i}>
                                        <Card style={{ backgroundColor: '#222', color: 'white' }}>
                                            <Title level={4} style={{ color: blueColor, fontWeight: 600 }}>
                                                {title}
                                            </Title>
                                            <Paragraph style={{ color: '#ccc' }}>
                                                Description for {title}
                                            </Paragraph>
                                        </Card>
                                    </Col>
                                )
                            )}
                        </Row>
                    </Content>

                    {/* <Content
            id="tech"
            style={{ padding: '80px 48px', background: '#222' }}
          >
            <Title
              level={2}
              style={{
                textAlign: 'center',
                marginBottom: 48,
                color: blueColor,
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              Built With Proven Technology
            </Title>
            <Row justify="center" style={{ marginTop: 48 }}>
              <Col xs={24} md={20}>
                <Paragraph style={{ color: '#ccc' }}>
                  Heritage Graph is built with a modern stack:
                </Paragraph>
                <ul style={{ color: '#ccc' }}>
                  <li>
                    <Text strong style={{ color: blueColor }}>
                      React + Ant Design
                    </Text>
                    : For fast, responsive UI
                  </li>
                  <li>
                    <Text strong style={{ color: blueColor }}>
                      Three.js + react-three-fiber
                    </Text>
                    : For real-time, interactive 3D graph visualizations
                  </li>
                  <li>
                    <Text strong style={{ color: blueColor }}>
                      SPARQL / GraphQL
                    </Text>
                    : For querying structured data in real time
                  </li>
                  <li>
                    <Text strong style={{ color: blueColor }}>
                      JSON-LD / RDF
                    </Text>
                    : For semantic interoperability and linked open data
                  </li>
                </ul>
              </Col>
            </Row>
          </Content> */}

                    {/* <Content style={{ padding: '80px 48px', background: '#111' }}>
            <Title
              level={2}
              style={{
                textAlign: 'center',
                color: blueColor,
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              What People Are Saying
            </Title>
            <Row gutter={[32, 32]} justify="center" style={{ marginTop: 48 }}>
              {[
                [
                  '“This is what cultural informatics needed—finally a graph-first, visually-native tool for heritage data.”',
                  '— Dr. L. Thompson',
                ],
                [
                  '“The interface is clean, intuitive, and fast. Perfect for our museum’s open data initiative.”',
                  '— Julia Park',
                ],
              ].map(([quote, name], i) => (
                <Col xs={24} md={8} key={i}>
                  <Card bordered={false} style={{ backgroundColor: '#222', color: 'white' }}>
                    <Paragraph style={{ color: '#ccc' }}>{quote}</Paragraph>
                    <Text type="secondary" style={{ color: '#888' }}>
                      {name}
                    </Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Content> */}

                    <Content style={{ padding: '80px 48px', background: '#222' }}>
                        <Title
                            level={2}
                            style={{
                                textAlign: 'center',
                                color: blueColor,
                                fontWeight: 700,
                                letterSpacing: '0.05em',
                            }}
                        >
                            Frequently Asked Questions
                        </Title>
                        <Row justify="center" style={{ marginTop: 48 }}>
                            <Col xs={24} md={16}>
                                <Collapse
                                    accordion
                                    style={{ backgroundColor: '#111' }}
                                // Override the header colors via CSS variables or inline styles
                                // but easiest is just styling Panel header inline below
                                >
                                    <Panel
                                        header="Is my data private?"
                                        key="1"
                                        style={{ color: 'white', backgroundColor: '#000' }}
                                        className="custom-collapse-panel"

                                    >
                                        <Paragraph style={{ color: 'white' }}>
                                            Yes. You can choose to keep data private or share it openly. Nothing is
                                            made public without your consent.
                                        </Paragraph>
                                    </Panel>
                                    <Panel
                                        header="Can I upload my own dataset?"
                                        key="2"
                                        style={{ color: 'white', backgroundColor: '#111' }}
                                        className="custom-collapse-panel"
                                    >
                                        <Paragraph style={{ color: '#ccc' }}>
                                            Yes. We support RDF, JSON-LD, and CSV imports with schema mapping tools
                                            available in the dashboard.
                                        </Paragraph>
                                    </Panel>
                                    <Panel
                                        header="Does it support SPARQL?"
                                        key="3"
                                        style={{ color: 'white', backgroundColor: '#111' }}
                                        className="custom-collapse-panel"
                                    >
                                        <Paragraph style={{ color: '#ccc' }}>
                                            Yes. Advanced users can run SPARQL queries directly from the interface or
                                            via API.
                                        </Paragraph>
                                    </Panel>

                                    <style jsx>{`
    /* Make panel header text white */
    .custom-collapse-panel .ant-collapse-header {
      color: white !important;
      background-color: #111 !important;
    }

    /* Highlight active panel header with blue background */
    .custom-collapse-panel.ant-collapse-item-active > .ant-collapse-header {
      background-color: #1890ff !important;
      color: white !important;
    }
  `}</style>
                                </Collapse>
                            </Col>
                        </Row>
                    </Content>

                    <Content style={{ background: '#111', padding: '80px 48px' }}>
                        <Row justify="center" align="middle">
                            <Col xs={24} md={16} style={{ textAlign: 'center' }}>
                                <Title
                                    style={{
                                        color: blueColor,
                                        fontWeight: 700,
                                        letterSpacing: '0.05em',
                                    }}
                                >
                                    Start Exploring Cultural Knowledge Today
                                </Title>
                                <Paragraph style={{ fontSize: '1.2rem', color: '#ccc' }}>
                                    Heritage Graph is free to try with a demo dataset. Dive into your heritage,
                                    visually.
                                </Paragraph>
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<ArrowRightOutlined />}
                                    style={{ backgroundColor: blueColor, borderColor: blueColor }}
                                >
                                    Try Demo
                                </Button>
                            </Col>
                        </Row>
                    </Content>

                    <Footer
                        style={{
                            textAlign: 'center',
                            padding: '32px 48px',
                            background: '#111',
                            color: '#555',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                        }}
                    >
                        Heritage Graph © {new Date().getFullYear()} · Built by Researchers @ CAIR-Nepal.
                    </Footer>
                </Layout>
            </div>
        </>
    );
}
