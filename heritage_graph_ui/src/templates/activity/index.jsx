import React, { useEffect, useState } from "react";
import axios from "axios";
import { Timeline, Pagination, Spin } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import Layout from "../../components/Layout";
import config from "../../assets/config";

const Activity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:8000/data/activity-logs/");
        if (response.status === 200) {
          const fetchedActivities = response.data.map((activity) => ({
            dot: <ClockCircleOutlined className="timeline-clock-icon" />,
            color: "blue",
            children: `${activity.user} - ${activity.description} (${new Date(activity.timestamp).toLocaleString()})`,
          }));
          setActivities(fetchedActivities);
        } else {
          console.error("Unexpected response:", response);
        }
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = activities.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <Layout title="Activity Log">
      <div className={`dc-page ${config.container}`}>
        <h1>Activity Log</h1>
        <div className="dc-page-content row">
          <div className="col-md-9 col-sm-12">
            {loading ? (
              <Spin />
            ) : (
              <>
                <Timeline items={currentItems} />
                <Pagination
                  current={currentPage}
                  pageSize={itemsPerPage}
                  total={activities.length}
                  onChange={handlePageChange}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Activity;
