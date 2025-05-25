import React from 'react';
import { PublisherList } from "@civicactions/data-catalog-components";
import config from "../../assets/config";
import Layout from '../../components/Layout';
import orgs from "../../assets/publishers";

const Publishers = () => {
  return (
    <Layout title="Dataset Publishers">
    <div className={`dc-page ${config.container}`}>
      <div>

        <PublisherList items = {orgs} />

      </div>
    </div>
    </Layout>
  );
}

export default Publishers;
