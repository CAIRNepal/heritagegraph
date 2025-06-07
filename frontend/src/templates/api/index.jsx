import React from "react";
import config from "../../assets/config";
import Layout from "../../components/Layout";
import { ApiDocs } from "@civicactions/data-catalog-components";

// Prefer Vite's environment variable, fallback to public IP for Docker
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://37.27.182.103:8000";

const ApiDocsFull = () => {
  const openApiUrl = `${API_BASE_URL}/openapi.json/`;

  return (
    <Layout title="API Documentation">
      <div className={`dc-page ${config.container}`}>
        <div className="page-content">
          {typeof window !== "undefined" && (
            <ApiDocs endpoint={openApiUrl} />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ApiDocsFull;
