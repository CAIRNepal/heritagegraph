import React from "react";
import { Card, Avatar, Space } from "antd"; 
import { GithubOutlined, LinkedinOutlined, UserOutlined } from "@ant-design/icons";
import Layout from "../../components/Layout";
import config from "../../assets/config";

const contributors = [
    { 
        name: "Nabin", role: "Lead Developer", 
        github: "https://github.com/nabin2004", 
        linkedin: "https://www.linkedin.com/in/nabin2004",
        photo: "https://randomuser.me/api/portraits/men/1.jpg"
    },
    { 
        name: "Aarav", role: "Data Scientist", 
        github: "https://github.com/aarav", 
        linkedin: "https://www.linkedin.com/in/aarav",
        photo: "https://randomuser.me/api/portraits/men/2.jpg"
    },
    { 
        name: "Sneha", role: "Researcher", 
        github: "https://github.com/sneha", 
        linkedin: "https://www.linkedin.com/in/sneha",
        photo: "https://randomuser.me/api/portraits/women/3.jpg"
    },
    { 
        name: "Bikash", role: "UI/UX Designer", 
        github: "https://github.com/bikash", 
        linkedin: "https://www.linkedin.com/in/bikash",
        photo: "https://randomuser.me/api/portraits/men/4.jpg"
    },
];

const Contributors = () => (
    <Layout title="Our Team">
        <div className={`dc-page ${config.container}`}>
            <h1>Our Team</h1>
            <div className="row">
                {contributors.map((contributor, index) => (
                    <div key={index} className="col-md-3 col-sm-6">
                        <Card title={contributor.name} hoverable={true} bordered={true} style={{ textAlign: "center" }}>
                            <Avatar 
                                src={contributor.photo} 
                                size={80} 
                                icon={<UserOutlined />} 
                                style={{ marginBottom: "10px" }} 
                            />
                            <p>{contributor.role}</p>
                            <Space>
                                <a href={contributor.github} target="_blank" rel="noopener noreferrer">
                                    <Avatar icon={<GithubOutlined />} size="large" />
                                </a>
                                <a href={contributor.linkedin} target="_blank" rel="noopener noreferrer">
                                    <Avatar icon={<LinkedinOutlined />} size="large" style={{ backgroundColor: "#0077B5" }} />
                                </a>
                            </Space>
                        </Card>
                    </div>
                ))}
            </div>
        </div>
    </Layout>
);

export default Contributors;
