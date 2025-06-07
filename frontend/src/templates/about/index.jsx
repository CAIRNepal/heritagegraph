import React from "react";
import { Announcement } from "@civicactions/data-catalog-components";
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

const maintainers = [
    { 
        name: "Rohan", role: "Project Manager", 
        github: "https://github.com/rohan", 
        linkedin: "https://www.linkedin.com/in/rohan",
        photo: "https://randomuser.me/api/portraits/men/5.jpg"
    },
    { 
        name: "Priya", role: "Software Engineer", 
        github: "https://github.com/priya", 
        linkedin: "https://www.linkedin.com/in/priya",
        photo: "https://randomuser.me/api/portraits/women/6.jpg"
    },
];

const About = () => (
    <Layout title="About">
        <div className={`dc-page ${config.container}`}>
            <h1>About Heritage Graph</h1>
            <div className="dc-page-content row">
                <div className="col-md-9 col-sm-12" style={{ textAlign: "justify" }}>
                    <p>
                    Cultural heritage embodies the collective memory, identity, and wisdom of humanity, thereby influencing our present and future while providing invaluable insights into our shared past. In the digital age, it is essential to digitize cultural heritage to guarantee its accessibility, preservation, and ongoing significance. By digitizing artifacts, documents, and traditions, we effectively protect them from physical degradation and loss. This process democratizes access to invaluable cultural assets, allowing for greater engagement and education from a wider audience. Moreover, digitalization advances interdisciplinary research, collaboration, and innovation, offering novel opportunities to comprehend and interpret our cultural heritage. Safeguarding the fundamental nature of cultural heritage for future generations promotes cultural comprehension and exchange, enabling present and future generations to reconnect with their origins and chart new courses.
                    </p>
                </div>

                <div className="col-md-3 col-sm-12">
                    <Announcement variation="info" heading="Heritage Graph">
                        Together we can showcase our rich Nepalese Cultural Heritage through state-of-the-art methodology.
                    </Announcement>
                </div>

                <div className="col-md-9 col-sm-12" style={{ textAlign: "justify" }}>
                    <h1>Our Mission</h1>
                    <p>
                    At HeritageGraph, our mission is to digitize cultural heritage using knowledge graphs (KGs). KGs capture complex information in a format that is both machine-readable and human-comprehensible. They provide a powerful visual representation of interconnected concepts, entities, and relationships, enabling meaningful insights derived from disparate data sources. Through this project, we focus on creating a machine-processable knowledge representation of Nepalese cultural heritage, ensuring its preservation and accessibility for generations to come.
                    </p>
                </div>
            </div>

            <br />

            <br />
            <h2>Contributors</h2>
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
            <br/>
        </div>
    </Layout>
);

export default About;
