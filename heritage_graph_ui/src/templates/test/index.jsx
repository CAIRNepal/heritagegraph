import React, { useEffect, useState } from "react";
import axios from "axios";
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from '../../assets/config';
import { Spin } from 'antd';
import { version, dependencies } from '../../../package.json';
import WebformSubmissionTable from "../../components/table";

const WebformSubmissions = () => {
  const [submissionIds, setSubmissionIds] = useState([]);

  useEffect(() => {
    axios.get('https://nchlod.ddev.site/jsonapi/webform_submission/nchlod1')
      .then(response => {
        console.log('API response:', response); 
        if (response.data && response.data.data) {
          const ids = response.data.data.map(submission => submission.id);
          console.log('Extracted IDs:', ids); 
          setSubmissionIds(ids);
        } else {
          console.error('Unexpected response structure:', response);
        }
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }, []);

  return (
    <Layout title="WebformSubmissions">
      <div className={`dc-page ${config.container}`}>
        <h1>Webform Submissions</h1>

        <div className="dc-page-content row">
          <div className="col-12">
            {submissionIds.length > 0 ? (
              <WebformSubmissionTable uuids={submissionIds} />
            ) : (
                 <Spin />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default WebformSubmissions;
