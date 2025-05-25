import React from "react";
import config from "../../assets/config";
import Layout from "../../components/Layout";
import { ApiDocs } from "@civicactions/data-catalog-components";

// // Use Vite's environment variable for the backend API URL
// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http:....
const ApiDocsFull = () => (
  <Layout title="API Documentation">
    <div className={`dc-page ${config.container}`}>
      <div className="page-content">
    =     API coming soon.
      </div>
    </div>
  </Layout>
);

export default ApiDocsFull;
