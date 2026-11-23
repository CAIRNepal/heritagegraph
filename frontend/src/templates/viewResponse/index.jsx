import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Announcement } from "@civicactions/data-catalog-components";
import Layout from '../../components/Layout';
import config from "../../assets/config";
import axios from "axios";
import "./ViewResponse.css";

const ViewResponse = () => {
  const { id } = useParams();
  const [responseData, setResponseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`https://nchlod.ddev.site/webform_rest/nchlod1/submission/${id}`)
      .then(response => {
        setResponseData(response.data);
        setLoading(false);
      })
      .catch(error => {
        setError(error);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading response data: {error.message}</p>;

  return (
    <Layout title="View Response">
      <div className={`dc-page ${config.container}`}>
        <div className="view-response-container">
          <h1 className="response-header">Response Details</h1>
          <div className="dc-page-content row">
            <div className="col-md-9 col-sm-12 response-details">
              <h2>Submission Information</h2>
              <p><strong>UUID:</strong> {responseData.entity.uuid[0].value}</p>
              <p><strong>Serial:</strong> {responseData.entity.serial[0].value}</p>
              <p><strong>SID:</strong> {responseData.entity.sid[0].value}</p>
              <p><strong>Created:</strong> {responseData.entity.created[0].value}</p>
              <p><strong>Completed:</strong> {responseData.entity.completed[0].value}</p>
              <p><strong>Changed:</strong> {responseData.entity.changed[0].value}</p>
              <p><strong>Email:</strong> {responseData.data.email}</p>
              <p><strong>First Name:</strong> {responseData.data.first_name}</p>
              <p><strong>Last Name:</strong> {responseData.data.last_name}</p>
              <p><strong>E59 Primitive Value:</strong> {responseData.data.e59_primitive_value}</p>
              <p><strong>E60 Number:</strong> {responseData.data.e60_number}</p>
              <p><strong>E61 Time Primitive:</strong> {responseData.data.e61_time_primitive}</p>
              <p><strong>E62 String:</strong> {responseData.data.e62_string}</p>
              <p><strong>Permit to Share Data:</strong> {responseData.data.i_permit_to_share_data}</p>
            </div>
            <div className="col-md-3 col-sm-12 announcement-container">
              <Announcement variation="info" heading="Response Details">
                Here you can see the detailed information of the selected submission.
              </Announcement>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ViewResponse;
