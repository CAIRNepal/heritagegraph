import React, { useEffect, useState } from "react";
import { useQuery } from '@tanstack/react-query';
import {
  Blocks,
  Hero,
  IconList,
  IconListItem,
  StatBlock
} from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import FeaturedDatasets from '../../components/FeaturedDatasets';
import copy from "../../assets/copy.json";
import { Breadcrumb, Card, Button, Typography, Avatar, Row, Col } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Title } = Typography;

const Home = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if the user is authenticated (by checking for the access token)
  useEffect(() => {
    const token = localStorage.getItem('accessToken'); // Assuming the accessToken is stored in localStorage
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const datasets = useQuery({
    queryKey: ['datasets'],
    queryFn: () => {
      return fetch(`${import.meta.env.VITE_REACT_APP_ROOT_URL}/metastore/schemas/dataset/items?show-reference-ids`).then(
        (res) => res.json(),
      )
    }
  }).data;

  const themes = useQuery({
    queryKey: ['themes'],
    queryFn: () => {
      return fetch(`${import.meta.env.VITE_REACT_APP_ROOT_URL}/metastore/schemas/theme/items`).then(
        (res) => res.json(),
      )
    }
  }).data;

  const orderedDatasets = (datasets && datasets.length) ? datasets.sort(function(a,b) {
    return a.title - b.title;
  }) : [];

  const fDatasets = orderedDatasets.length > 3 ? orderedDatasets.slice(orderedDatasets.length - 3, orderedDatasets.length) : orderedDatasets;

  const items = (themes && themes.length) ? 
    themes.map(x => {
      let item = {
        identifier: x.identifier,
        ref: `search?theme=${x.data}`,
        title: x.data,
        size: "100"
      };
      return item;
    }) : [];

  return (
    <Layout title="Home">
      <div className="home-page">
        {isAuthenticated ? (
          <div>
            {/* Centered and padded content */}
            <Row justify="center" style={{ padding: '20px' }}>
              <Col xs={24} sm={12} md={8}>
                <Card
                  title="Welcome Back!"
                  bordered={false}
                  style={{ width: '100%' }}
                  headStyle={{ backgroundColor: '#1890ff', color: '#fff' }}
                >
                  <Title level={3}>You are logged in!</Title>
                  <p>Here's a summary of your activities and data access.</p>
                </Card>
              </Col>
            </Row>

            {/* Additional content can go here */}
            <div style={{ padding: '20px' }}>
              <h2>Featured Datasets</h2>
              <FeaturedDatasets datasets={fDatasets} />
              <h2>Popular Themes</h2>
              <IconList
                items={items}
                component={IconListItem}
                paneTitle="Popular Themes"
                className="opendata-icon-list"
              />
              <Blocks
                items={copy.stats}
                component={StatBlock}
                containerClass=""
                blockClass="StatBlock"
              />
            </div>
          </div>
        ) : (
          <>
            {/* Content for non-authenticated users */}
            <Hero title={copy.hero[0].title} intro={copy.hero[0].intro} gradient={'rgb(22, 46, 81), rgb(9, 120, 188)'} />
            <div className="container" style={{ padding: '20px' }}>
              <IconList
                items={items}
                component={IconListItem}
                paneTitle="Popular Datasets"
                className="opendata-icon-list"
              />
            </div>
            <Blocks
              items={copy.stats}
              component={StatBlock}
              containerClass=""
              blockClass="StatBlock"
            />
            <FeaturedDatasets datasets={fDatasets} />
          </>
        )}
      </div>
    </Layout>
  );
};

export default Home;
